// BDR-012 fixture: the rules throw on enter.
export default {
  onEnter() {
    throw new Error('broken on purpose');
  }
};
