// BDR-011 fixture: an enter message and a "score" action with a saved score.
export default {
  // A radius of 0 gives the default radius, so this trigger fires at 0 -5.
  triggers: [{ position: [0, 0, -5], radius: 0, action: 'score' }],
  onEnter(ctx) {
    ctx.say('Welcome to the arcade');
  },
  actions: {
    score(ctx) {
      const n = (ctx.store.get('score') || 0) + 1;
      ctx.store.set('score', n);
      ctx.say('Score: ' + n);
    }
  }
};
