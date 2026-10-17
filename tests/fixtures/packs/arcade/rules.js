// BDR-011 fixture: an enter message and a "score" action with a saved score.
export default {
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
