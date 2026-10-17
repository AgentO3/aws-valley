// BDR-011 fixture: an enter message, a "score" action with a saved score, and a "quirks" action that
// gives the store and the model loader bad input.
export default {
  onEnter(ctx) {
    ctx.say('Welcome to the arcade');
  },
  actions: {
    score(ctx) {
      const n = (ctx.store.get('score') || 0) + 1;
      ctx.store.set('score', n);
      ctx.say('Score: ' + n);
    },
    quirks(ctx) {
      ctx.store.set('gone', undefined);
      ctx.model('../vault/gold/x.glb');
    }
  }
};
