package com.pikiapp.tablet;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Bluetooth Classic (SPP / RFCOMM) bridge to an ESC/POS thermal printer.
 *
 * The printer must already be paired in Android Settings - this plugin only
 * talks to bonded devices. All Bluetooth I/O runs on a single background
 * thread, which also serialises concurrent print jobs onto one socket.
 */
@CapacitorPlugin(
    name = "ThermalPrinter",
    permissions = {
        @Permission(
            alias = ThermalPrinterPlugin.BLUETOOTH_ALIAS,
            strings = { Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN }
        )
    }
)
public class ThermalPrinterPlugin extends Plugin {

    static final String BLUETOOTH_ALIAS = "bluetooth";

    /** Well-known Serial Port Profile UUID. */
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    /**
     * Cheap 58/80mm printers have tiny receive buffers and print garbage when
     * fed a single large burst, so writes are chunked and paced.
     */
    private static final int CHUNK_SIZE = 512;
    private static final long CHUNK_PAUSE_MS = 20;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private BluetoothSocket socket;
    private String connectedAddress;

    // ---------------------------------------------------------------- support

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject result = new JSObject();
        result.put("supported", getAdapter() != null);
        call.resolve(result);
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        BluetoothAdapter adapter = getAdapter();
        JSObject result = new JSObject();
        result.put("enabled", adapter != null && adapter.isEnabled());
        call.resolve(result);
    }

    // ------------------------------------------------------------ permissions

    @PluginMethod
    public void checkBluetoothPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasBluetoothPermission());
        call.resolve(result);
    }

    @PluginMethod
    public void requestBluetoothPermission(PluginCall call) {
        if (hasBluetoothPermission()) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        requestPermissionForAlias(BLUETOOTH_ALIAS, call, "bluetoothPermissionCallback");
    }

    @PermissionCallback
    private void bluetoothPermissionCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasBluetoothPermission());
        call.resolve(result);
    }

    /**
     * BLUETOOTH_CONNECT / BLUETOOTH_SCAN only became runtime permissions in
     * Android 12 (API 31). Below that the legacy install-time permissions in
     * the manifest are enough.
     */
    private boolean hasBluetoothPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return true;
        }
        return getContext().checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)
            == PackageManager.PERMISSION_GRANTED;
    }

    // ---------------------------------------------------------------- devices

    @PluginMethod
    public void listPairedDevices(PluginCall call) {
        BluetoothAdapter adapter = getAdapter();
        if (adapter == null) {
            call.reject("Bluetooth is not available on this device", "NO_ADAPTER");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("Bluetooth is turned off", "BT_DISABLED");
            return;
        }
        if (!hasBluetoothPermission()) {
            call.reject("Bluetooth permission not granted", "NO_PERMISSION");
            return;
        }

        JSArray devices = new JSArray();
        try {
            Set<BluetoothDevice> bonded = adapter.getBondedDevices();
            if (bonded != null) {
                for (BluetoothDevice device : bonded) {
                    JSObject entry = new JSObject();
                    entry.put("name", device.getName() != null ? device.getName() : device.getAddress());
                    entry.put("address", device.getAddress());
                    devices.put(entry);
                }
            }
        } catch (SecurityException e) {
            call.reject("Bluetooth permission not granted", "NO_PERMISSION");
            return;
        }

        JSObject result = new JSObject();
        result.put("devices", devices);
        call.resolve(result);
    }

    // ----------------------------------------------------------------- print

    @PluginMethod
    public void print(final PluginCall call) {
        final String address = call.getString("address");
        final String data = call.getString("data");

        if (address == null || address.isEmpty()) {
            call.reject("Missing printer address", "INVALID_ARGS");
            return;
        }
        if (data == null || data.isEmpty()) {
            call.reject("Missing print data", "INVALID_ARGS");
            return;
        }

        final byte[] payload;
        try {
            payload = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Print data is not valid base64", "INVALID_ARGS");
            return;
        }

        executor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    writeWithRetry(address, payload);
                    call.resolve();
                } catch (PrinterException e) {
                    call.reject(e.getMessage(), e.code);
                } catch (Exception e) {
                    call.reject("Print failed: " + e.getMessage(), "WRITE_FAILED");
                }
            }
        });
    }

    @PluginMethod
    public void disconnect(final PluginCall call) {
        executor.execute(new Runnable() {
            @Override
            public void run() {
                closeSocket();
                call.resolve();
            }
        });
    }

    // ------------------------------------------------------------- internals

    /**
     * Printers routinely drop an idle socket, so a stale-socket failure is
     * expected rather than exceptional: close, reconnect, and try once more.
     */
    private void writeWithRetry(String address, byte[] payload) throws PrinterException {
        try {
            connect(address);
            write(payload);
        } catch (IOException first) {
            closeSocket();
            try {
                connect(address);
                write(payload);
            } catch (IOException second) {
                closeSocket();
                throw new PrinterException("WRITE_FAILED", "Could not send data to the printer: " + second.getMessage());
            }
        }
    }

    private void connect(String address) throws PrinterException, IOException {
        if (socket != null && socket.isConnected() && address.equals(connectedAddress)) {
            return;
        }
        closeSocket();

        BluetoothAdapter adapter = getAdapter();
        if (adapter == null) {
            throw new PrinterException("NO_ADAPTER", "Bluetooth is not available on this device");
        }
        if (!adapter.isEnabled()) {
            throw new PrinterException("BT_DISABLED", "Bluetooth is turned off");
        }
        if (!hasBluetoothPermission()) {
            throw new PrinterException("NO_PERMISSION", "Bluetooth permission not granted");
        }

        try {
            if (!isBonded(adapter, address)) {
                throw new PrinterException("NOT_PAIRED", "Printer is not paired with this device");
            }

            BluetoothDevice device = adapter.getRemoteDevice(address);
            // An in-flight discovery starves the RFCOMM connect and makes it fail.
            adapter.cancelDiscovery();

            BluetoothSocket candidate = device.createRfcommSocketToServiceRecord(SPP_UUID);
            try {
                candidate.connect();
            } catch (IOException e) {
                try {
                    candidate.close();
                } catch (IOException ignored) {
                    // best effort
                }
                throw new PrinterException("CONNECT_FAILED", "Could not connect to the printer: " + e.getMessage());
            }

            socket = candidate;
            connectedAddress = address;
        } catch (SecurityException e) {
            throw new PrinterException("NO_PERMISSION", "Bluetooth permission not granted");
        } catch (IllegalArgumentException e) {
            throw new PrinterException("INVALID_ARGS", "Invalid printer address: " + address);
        }
    }

    private boolean isBonded(BluetoothAdapter adapter, String address) {
        Set<BluetoothDevice> bonded = adapter.getBondedDevices();
        if (bonded == null) {
            return false;
        }
        for (BluetoothDevice device : bonded) {
            if (address.equalsIgnoreCase(device.getAddress())) {
                return true;
            }
        }
        return false;
    }

    private void write(byte[] payload) throws IOException {
        if (socket == null) {
            throw new IOException("Not connected");
        }
        OutputStream out = socket.getOutputStream();
        int offset = 0;
        while (offset < payload.length) {
            int length = Math.min(CHUNK_SIZE, payload.length - offset);
            out.write(payload, offset, length);
            out.flush();
            offset += length;
            if (offset < payload.length) {
                try {
                    Thread.sleep(CHUNK_PAUSE_MS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new IOException("Print interrupted");
                }
            }
        }
    }

    private void closeSocket() {
        if (socket != null) {
            try {
                socket.close();
            } catch (IOException ignored) {
                // best effort
            }
        }
        socket = null;
        connectedAddress = null;
    }

    private BluetoothAdapter getAdapter() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return manager != null ? manager.getAdapter() : null;
    }

    @Override
    protected void handleOnDestroy() {
        closeSocket();
        executor.shutdown();
        super.handleOnDestroy();
    }

    private static class PrinterException extends Exception {
        final String code;

        PrinterException(String code, String message) {
            super(message);
            this.code = code;
        }
    }
}
