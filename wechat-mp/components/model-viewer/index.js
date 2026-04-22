const ModelRenderer = require('./utils/ModelRenderer');
Component({
  properties: {
    bgColor:  { type: String, value: '#1a1a2e' },
    canvasId: { type: String, value: 'model-viewer-canvas' },
    skyboxUrl: { type: String, value: '' },
  },

  data: {
    loading: false,
    error: '',
  },

  lifetimes: {
    ready() {
      setTimeout(() => this._initRenderer(), 300);
    },
    detached() {
      if (this._renderer) this._renderer.dispose();
    },
  },

  methods: {
    loadModel(url) {
      if (!this._renderer) {
        return new Promise((resolve, reject) => {
          this._pendingLoad = { url, resolve, reject };
        });
      }
      return this._doLoad(url);
    },

    switchModel(url) {
      if (this._renderer) this._renderer._clearCurrentModel();
      return this.loadModel(url);
    },

    applyDecal(url, options = {}) {
      if (!this._renderer) return Promise.reject(new Error('renderer not ready'));
      return this._renderer.applyDecal(url, options);
    },

    updateDecal(angle, height, scaleX = 1.0, scaleY = 1.0) {
      this._renderer && this._renderer.updateDecal(angle, height, scaleX, scaleY);
    },

    removeDecal() {
      this._renderer && this._renderer.removeDecal();
    },

    setSkybox(url) {
      if (!url) return;
      if (this._renderer && this._renderer.setEnvMap) {
        this._renderer.setEnvMap(url, true);
      } else {
        this._pendingSkybox = url;
      }
    },

    onTouchStart(e) {
      this._renderer && this._renderer.onTouchStart(e);
    },

    onTouchMove(e) {
      this._renderer && this._renderer.onTouchMove(e);
    },

    onTouchEnd(e) {
      this._touchLocked = null;
      this._renderer && this._renderer.onTouchEnd(e);
    },

    _initRenderer() {
      const tryQuery = () => {
        wx.createSelectorQuery()
          .in(this)
          .select('#' + this.data.canvasId)
          .fields({ node: true, size: true })
          .exec((res) => {
            if (!res || !res[0] || !res[0].node) {
              setTimeout(tryQuery, 200);
              return;
            }
            const { node, width, height } = res[0];
            const skybox = this._pendingSkybox || this.data.skyboxUrl || '';
            this._renderer = new ModelRenderer(node, {
              bgColor: this.data.bgColor,
              envMap: skybox || null,
              showSkybox: !!skybox,
              width,
              height,
            });
            this._pendingSkybox = null;

            if (this._pendingLoad) {
              const { url, resolve, reject } = this._pendingLoad;
              this._pendingLoad = null;
              this._doLoad(url).then(resolve).catch(reject);
            }
          });
      };
      tryQuery();
    },

    _doLoad(url) {
      this.setData({ loading: true, error: '' });
      return this._renderer.loadModel(url)
        .then(() => this.setData({ loading: false }))
        .catch((err) => {
          console.error('[model-viewer] load error:', err);
          this.setData({ loading: false, error: String(err.message || err) });
        });
    },
  },
});
