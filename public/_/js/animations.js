class AnimationStep {
  repeats = 1;
  async playOnce() {
    await this.setup();
    await new Promise((r) => requestAnimationFrame(r));
    this.raiseIfStop();

    await this.run();
    await new Promise((r) => requestAnimationFrame(r));
    this.raiseIfStop();

    await this.finish();
    await new Promise((r) => requestAnimationFrame(r));
    this.raiseIfStop();
  }

  async play() {
    try {
      for (let i = 0; i < this.repeats; i++) {
        await this.playOnce();
      }
    } catch (err) {
      if (err instanceof AnimationStop) {
        /// Just bring animation to an end;
      } else {
        throw err;
      }
    }
  }

  stop() {
    this.stopping = true;
  }

  raiseStop() {
    if (this.stopping) {
      this.stopping = false;
      throw new AnimationStop();
    }
  }

  async setup() {}
  async run() {}
  async finish() {}
}

class AnimationStop extends Error {}

class FlashNode extends AnimationStep {
  node = null;
  constructor(node) {
    super();
    this.node = node;
  }

  async setup() {
    this.node.style.boxShadow = "1px 1px 3px rgba(255,0,0,0.5)";
  }

  async run() {
    /// Or use CSS animation with keyframes, which is nicer. Just need to store the keyframes in a CSS file,
    /// or include them in an inline <style> tag, and the CSS animation needs to be written such that they work
    /// generically with any appropriate element.
    let dur = 0.5; //s
    this.node.style.transition = `box-shadow ${dur}s`;
    this.node.style.boxShadow = "1px 1px 0 rgba(255,0,0,0.5)";
    await new Promise((r) => setTimeout(r, dur * 1000));
  }

  async finish() {
    this.node.style.transition = "";
  }
}

class AnimationQueue extends AnimationStep {
  queue = [];
  current = 0;
  constructor(queue) {
    this.queue = queue;
  }

  stop() {
    super.stop();
    this.queue[current]?.stop?.();
  }

  async setup() {
    this.current = 0;
  }

  async run() {
    for (; this.current < queue.length; this.current++) {
      await step.play();
    }
  }
}

// new AnimationQueue([
//     new FlashNode(.,,,)
//     new ArcAnimate(...),
// ])
