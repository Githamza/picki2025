import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SoundNotificationService {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private isEnabled = true;
  private volume = 0.7;
  private readonly soundFile = 'confident-notif.mp3';

  constructor() {
    // Initialize audio context and load sound file on first user interaction
    this.initializeAudioContext();
  }

  private initializeAudioContext() {
    // Create audio context on first user interaction to comply with browser autoplay policies
    const initAudio = async () => {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
        
        // Load the sound file
        await this.loadSoundFile();
      }
    };

    // Listen for any user interaction to initialize audio context
    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('keydown', initAudio, { once: true });
    document.addEventListener('touchstart', initAudio, { once: true });
  }

  private async loadSoundFile(): Promise<void> {
    if (!this.audioContext) {
      return;
    }

    try {
      const response = await fetch(`/${this.soundFile}`);
      if (!response.ok) {
        throw new Error(`Failed to load sound file: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      console.log('Sound file loaded successfully');
    } catch (error) {
      console.error('Error loading sound file:', error);
    }
  }

  /**
   * Play a notification sound for new orders
   */
  async playNewOrderSound(): Promise<void> {
    if (!this.isEnabled || !this.audioContext) {
      return;
    }

    try {
      // Ensure the sound file is loaded
      const isLoaded = await this.ensureSoundLoaded();
      if (!isLoaded) {
        console.warn('Sound file not loaded, cannot play notification');
        return;
      }

      // Resume audio context if it's suspended (required by some browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create audio source from the loaded buffer
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();

      // Set the audio buffer
      source.buffer = this.audioBuffer!;

      // Connect nodes
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Set volume
      gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);

      // Play the sound
      source.start(this.audioContext.currentTime);

      console.log('New order notification sound played');
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }

  /**
   * Play a custom notification sound (uses the loaded audio file)
   */
  async playCustomSound(): Promise<void> {
    // Use the same method as playNewOrderSound since we're using a single audio file
    await this.playNewOrderSound();
  }

  /**
   * Ensure the sound file is loaded before playing
   */
  private async ensureSoundLoaded(): Promise<boolean> {
    if (!this.audioContext) {
      return false;
    }

    if (!this.audioBuffer) {
      await this.loadSoundFile();
    }

    return this.audioBuffer !== null;
  }

  /**
   * Enable or disable sound notifications
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`Sound notifications ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set the volume for notification sounds (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    console.log(`Sound notification volume set to ${this.volume}`);
  }

  /**
   * Check if sound notifications are enabled
   */
  isSoundEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Get current volume level
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Preload the sound file for better performance
   */
  async preloadSound(): Promise<void> {
    if (this.audioContext && !this.audioBuffer) {
      await this.loadSoundFile();
    }
  }

  /**
   * Check if the sound file is loaded
   */
  isSoundLoaded(): boolean {
    return this.audioBuffer !== null;
  }

  /**
   * Play the notification sound with retry logic
   */
  async playNotificationWithRetry(maxRetries: number = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.playNewOrderSound();
        return; // Success, exit the retry loop
      } catch (error) {
        console.warn(`Attempt ${attempt} failed to play notification:`, error);
        if (attempt === maxRetries) {
          console.error('All attempts to play notification failed');
        } else {
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
  }
}
