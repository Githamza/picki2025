import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VendorService } from '../../services/vendor.service';

@Component({
  selector: 'app-vendor-cache-test',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="vendor-cache-test">
      <h3>Vendor Cache Test</h3>
      <div class="test-controls">
        <button mat-raised-button color="primary" (click)="testMultipleLoads()">
          Test Multiple LoadVendors() Calls
        </button>
        <button mat-raised-button color="accent" (click)="clearCache()">
          Clear Cache
        </button>
        <button mat-raised-button (click)="resetCounter()">
          Reset API Counter
        </button>
      </div>
      
      <div class="test-results">
        <p><strong>API Call Count:</strong> {{ apiCallCount }}</p>
        <p><strong>Vendors Loaded:</strong> {{ vendorCount }}</p>
        <p><strong>Cache Status:</strong> {{ cacheStatus }}</p>
        <p><strong>Last Test Result:</strong> {{ lastTestResult }}</p>
      </div>

      <div class="test-log">
        <h4>Test Log:</h4>
        <div *ngFor="let log of testLogs" class="log-entry">
          {{ log }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .vendor-cache-test {
      padding: 20px;
      max-width: 600px;
      margin: 0 auto;
    }
    
    .test-controls {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    
    .test-results {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    
    .test-results p {
      margin: 5px 0;
    }
    
    .test-log {
      background: #fafafa;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 15px;
      max-height: 200px;
      overflow-y: auto;
    }
    
    .log-entry {
      font-family: monospace;
      font-size: 12px;
      margin: 2px 0;
      padding: 2px 0;
      border-bottom: 1px solid #eee;
    }
    
    .log-entry:last-child {
      border-bottom: none;
    }
  `]
})
export class VendorCacheTestComponent implements OnInit {
  private vendorService = inject(VendorService);
  
  apiCallCount = 0;
  vendorCount = 0;
  cacheStatus = 'Unknown';
  lastTestResult = 'No test run yet';
  testLogs: string[] = [];

  ngOnInit() {
    this.updateStatus();
  }

  private addLog(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    this.testLogs.unshift(`[${timestamp}] ${message}`);
    if (this.testLogs.length > 20) {
      this.testLogs = this.testLogs.slice(0, 20);
    }
  }

  private updateStatus() {
    this.apiCallCount = this.vendorService.getApiCallCount();
    this.vendorCount = this.vendorService.getTotalVendorsCount();
    
    // Check if cache is likely valid (this is a simple heuristic)
    const vendors = this.vendorService.getTotalVendorsCount();
    this.cacheStatus = vendors > 0 ? 'Data Available' : 'No Data';
  }

  async testMultipleLoads() {
    this.addLog('🧪 Starting multiple loadVendors() test...');
    this.lastTestResult = 'Test in progress...';
    
    try {
      // Reset counter to see how many API calls we make
      this.vendorService.resetApiCallCount();
      this.updateStatus();
      
      // Simulate multiple components calling loadVendors() concurrently
      this.addLog('📞 Calling loadVendors() #1');
      const promise1 = this.vendorService.loadVendors();
      
      this.addLog('📞 Calling loadVendors() #2 (concurrent)');
      const promise2 = this.vendorService.loadVendors();
      
      this.addLog('📞 Calling loadVendors() #3 (concurrent)');
      const promise3 = this.vendorService.loadVendors();
      
      // Wait for all to complete
      await Promise.all([promise1, promise2, promise3]);
      
      this.addLog('⏳ Waiting 1 second...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.addLog('📞 Calling loadVendors() #4 (after cache should be warm)');
      await this.vendorService.loadVendors();
      
      this.addLog('📞 Calling loadVendors() #5 (should use cache)');
      await this.vendorService.loadVendors();
      
      this.updateStatus();
      
      const expectedCalls = 1; // Should only be 1 API call due to caching
      const actualCalls = this.vendorService.getApiCallCount();
      
      if (actualCalls === expectedCalls) {
        this.lastTestResult = `✅ SUCCESS: Only ${actualCalls} API call(s) made (expected 1)`;
        this.addLog(`✅ Test PASSED: ${actualCalls} API call(s) made`);
      } else {
        this.lastTestResult = `❌ FAILED: ${actualCalls} API calls made (expected 1)`;
        this.addLog(`❌ Test FAILED: ${actualCalls} API calls made`);
      }
      
    } catch (error) {
      this.lastTestResult = '❌ Test failed with error';
      this.addLog(`❌ Test ERROR: ${error}`);
    }
  }

  clearCache() {
    this.vendorService.clearCache();
    this.addLog('🗑️ Cache cleared manually');
    this.updateStatus();
  }

  resetCounter() {
    this.vendorService.resetApiCallCount();
    this.addLog('🔄 API call counter reset');
    this.updateStatus();
  }
}