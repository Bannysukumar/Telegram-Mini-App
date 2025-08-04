// Object Pool for better performance and memory management
class ObjectPool {
  constructor(createFn, resetFn, initialSize = 10) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.pool = [];
    this.activeObjects = new Set();
    
    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(createFn());
    }
  }

  get() {
    let obj;
    if (this.pool.length > 0) {
      obj = this.pool.pop();
    } else {
      obj = this.createFn();
    }
    this.activeObjects.add(obj);
    return obj;
  }

  release(obj) {
    if (this.activeObjects.has(obj)) {
      this.resetFn(obj);
      this.activeObjects.delete(obj);
      this.pool.push(obj);
    }
  }

  releaseAll() {
    for (const obj of this.activeObjects) {
      this.resetFn(obj);
      this.pool.push(obj);
    }
    this.activeObjects.clear();
  }

  getActiveCount() {
    return this.activeObjects.size;
  }

  getPoolSize() {
    return this.pool.length;
  }
}

export default ObjectPool; 