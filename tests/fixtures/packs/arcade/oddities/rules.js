// Red team fixture: a null entry in triggers, an action name that is a property of Object,
// and a canEnter that returns a promise.
export default {
  triggers: [null, { action: 'constructor', radius: 2 }, { action: 'ping', radius: 2 }],
  actions: {
    ping(ctx) {
      ctx.say('ping');
    }
  },
  async canEnter() {
    return false;
  }
};
