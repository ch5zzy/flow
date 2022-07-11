export default class Cookie {
  static set(key, value, expiry=-1) {
    var currVal = localStorage.getItem(key) || null;
    if(currVal && Date.now() < currVal.expiry) {
      throw "Key already exists"
    }

    localStorage.setItem(key, JSON.stringify({
      value: value,
      expiry: (expiry != -1) ? Date.now() + (expiry * 1000) : expiry
    }));
  }

  static get(key) {
    var currVal = localStorage.getItem(key) || null;

    if(!currVal) {
      return null;
    }

    currVal = JSON.parse(currVal);
    if(currVal.expiry != -1 && Date.now() > currVal.expiry) {
      localStorage.removeItem(key);
      return null;
    }

    return currVal.value;
  }

  static delete(key) {
    var currVal = get(key);
    localStorage.removeItem(key);
    return currVal;
  }
}
