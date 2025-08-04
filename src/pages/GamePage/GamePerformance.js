// Performance monitoring utility for the game
class GamePerformance {
  constructor() {
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fps = 0;
    this.frameTimes = [];
    this.maxFrameTimeHistory = 60; // Keep last 60 frames
  }

  update() {
    this.frameCount++;
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;
    
    // Calculate FPS
    if (deltaTime > 0) {
      this.fps = 1000 / deltaTime;
    }
    
    // Store frame time for averaging
    this.frameTimes.push(deltaTime);
    if (this.frameTimes.length > this.maxFrameTimeHistory) {
      this.frameTimes.shift();
    }
    
    this.lastTime = currentTime;
  }

  getAverageFPS() {
    if (this.frameTimes.length === 0) return 0;
    const totalTime = this.frameTimes.reduce((sum, time) => sum + time, 0);
    return 1000 / (totalTime / this.frameTimes.length);
  }

  getCurrentFPS() {
    return this.fps;
  }

  getFrameTime() {
    return this.frameTimes[this.frameTimes.length - 1] || 0;
  }

  getAverageFrameTime() {
    if (this.frameTimes.length === 0) return 0;
    return this.frameTimes.reduce((sum, time) => sum + time, 0) / this.frameTimes.length;
  }

  reset() {
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fps = 0;
    this.frameTimes = [];
  }

  // Log performance metrics
  logMetrics() {
    console.log(`FPS: ${this.getCurrentFPS().toFixed(2)} | Avg FPS: ${this.getAverageFPS().toFixed(2)} | Frame Time: ${this.getFrameTime().toFixed(2)}ms`);
  }
}

export default GamePerformance; 