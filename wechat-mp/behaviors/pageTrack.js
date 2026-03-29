const { trackCurrentPage } = require('../utils/pageTrack');

module.exports = Behavior({
  pageLifetimes: {
    show() {
      trackCurrentPage();
    },
  },
});
