class AuthProvider {
    constructor() {
        this.services = {};
        this.activeProvider = 'google'; // Default
    }

    registerService(name, service) {
        this.services[name] = service;
    }

    setProvider(name) {
        if (this.services[name]) {
            this.activeProvider = name;
        }
    }

    getService(name) {
        return this.services[name || this.activeProvider];
    }
}

module.exports = new AuthProvider();
