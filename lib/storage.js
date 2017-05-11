module.exports = {
  constructor: function(namespace) {
    this.namespace = namespace;
  },
  get: function(key) {
    var storageKey = this.namespace + ':' + key;
    console.log(this.store(storageKey));
    var record = this.store(storageKey);
    if (!record){return false;}
    return (new Date().getTime() < record.timestamp && JSON.parse(record.value));
  },

  /**
   *
   * @param keyOrObject
   * @param value
   * @param expirationMin expire minutes
     */
  set: function(keyOrObject, value, expirationMin) {
    if (typeof expirationMin === 'undefined') {
      expirationMin = 60;
    }
    var expirationMS = expirationMin * 60 * 1000;
    if (typeof keyOrObject === 'string') {
      var storageKey = this.namespace + ':' + keyOrObject;
      var record = {value: JSON.stringify(value), timestamp: new Date().getTime() + expirationMS};
      this.store(storageKey, record);
    } else if (typeof keyOrObject === 'object') {
      Object.keys(keyOrObject).forEach(function(key) {
        var storageKey = this.namespace + ':' + key;
        var record = {value: JSON.stringify(keyOrObject[storageKey]), timestamp: new Date().getTime() + expirationMS};
        this.store(storageKey, record);
      });
    }
  }
};