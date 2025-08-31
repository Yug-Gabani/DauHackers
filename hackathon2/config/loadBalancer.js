const cluster = require('cluster');
const os = require('os');
const logger = require('../utils/logger');

class LoadBalancer {
  constructor() {
    this.numCPUs = os.cpus().length;
    this.workers = new Map();
    this.isMaster = cluster.isMaster;
  }

  // Start master process with worker management
  startMaster() {
    if (!this.isMaster) return;

    logger.info(`🚀 Master ${process.pid} is running`);
    logger.info(`💻 Forking ${this.numCPUs} workers...`);

    // Fork workers
    for (let i = 0; i < this.numCPUs; i++) {
      this.forkWorker();
    }

    // Handle worker events
    cluster.on('fork', (worker) => {
      logger.info(`👷 Worker ${worker.process.pid} forked`);
    });

    cluster.on('online', (worker) => {
      logger.info(`✅ Worker ${worker.process.pid} is online`);
      this.workers.set(worker.id, worker);
    });

    cluster.on('listening', (worker, address) => {
      logger.info(`🎧 Worker ${worker.process.pid} listening on ${address.address}:${address.port}`);
    });

    cluster.on('disconnect', (worker) => {
      logger.warn(`❌ Worker ${worker.process.pid} disconnected`);
      this.workers.delete(worker.id);
    });

    cluster.on('exit', (worker, code, signal) => {
      logger.warn(`💀 Worker ${worker.process.pid} died (${signal || code})`);
      this.workers.delete(worker.id);
      
      // Replace the dead worker
      setTimeout(() => {
        logger.info(`🔄 Replacing dead worker ${worker.process.pid}`);
        this.forkWorker();
      }, 1000);
    });

    // Graceful shutdown handling
    process.on('SIGTERM', () => {
      logger.info('🛑 SIGTERM received, shutting down gracefully');
      this.shutdownGracefully();
    });

    process.on('SIGINT', () => {
      logger.info('🛑 SIGINT received, shutting down gracefully');
      this.shutdownGracefully();
    });

    // Health monitoring
    setInterval(() => {
      this.monitorWorkers();
    }, 30000); // Check every 30 seconds
  }

  // Fork a new worker
  forkWorker() {
    const worker = cluster.fork();
    this.workers.set(worker.id, worker);
    return worker;
  }

  // Monitor worker health
  monitorWorkers() {
    if (!this.isMaster) return;

    const activeWorkers = this.workers.size;
    const expectedWorkers = this.numCPUs;

    logger.info(`📊 Worker Status: ${activeWorkers}/${expectedWorkers} active`);

    // Check if we need to spawn more workers
    if (activeWorkers < expectedWorkers) {
      logger.info(`🔄 Spawning ${expectedWorkers - activeWorkers} additional workers`);
      for (let i = activeWorkers; i < expectedWorkers; i++) {
        this.forkWorker();
      }
    }

    // Check worker memory usage
    this.workers.forEach((worker, id) => {
      if (worker.process.connected) {
        worker.send('health-check');
      }
    });
  }

  // Graceful shutdown
  async shutdownGracefully() {
    logger.info('🔄 Starting graceful shutdown...');

    // Stop accepting new connections
    const promises = [];
    
    this.workers.forEach((worker) => {
      if (worker.process.connected) {
        promises.push(
          new Promise((resolve) => {
            worker.send('shutdown');
            worker.once('disconnect', resolve);
          })
        );
      }
    });

    // Wait for workers to disconnect
    if (promises.length > 0) {
      await Promise.allSettled(promises);
      logger.info('✅ All workers disconnected');
    }

    logger.info('🔄 Master process shutting down');
    process.exit(0);
  }

  // Get cluster statistics
  getStats() {
    if (!this.isMaster) return null;

    return {
      master: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      },
      workers: {
        total: this.workers.size,
        expected: this.numCPUs,
        active: Array.from(this.workers.values()).filter(w => w.process.connected).length
      },
      system: {
        cpus: this.numCPUs,
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version
      }
    };
  }

  // Restart all workers
  restartWorkers() {
    if (!this.isMaster) return;

    logger.info('🔄 Restarting all workers...');
    
    this.workers.forEach((worker) => {
      if (worker.process.connected) {
        worker.kill('SIGTERM');
      }
    });
  }

  // Scale workers up or down
  scaleWorkers(count) {
    if (!this.isMaster) return;

    const currentCount = this.workers.size;
    
    if (count > currentCount) {
      // Scale up
      const toAdd = count - currentCount;
      logger.info(`📈 Scaling up: adding ${toAdd} workers`);
      for (let i = 0; i < toAdd; i++) {
        this.forkWorker();
      }
    } else if (count < currentCount) {
      // Scale down
      const toRemove = currentCount - count;
      logger.info(`📉 Scaling down: removing ${toRemove} workers`);
      
      const workersArray = Array.from(this.workers.values());
      for (let i = 0; i < toRemove; i++) {
        if (workersArray[i] && workersArray[i].process.connected) {
          workersArray[i].kill('SIGTERM');
        }
      }
    }
  }
}

module.exports = LoadBalancer;
