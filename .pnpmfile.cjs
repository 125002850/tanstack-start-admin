module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === 'react-virtual' && pkg.version === '2.10.4') {
        pkg.peerDependencies = {
          ...pkg.peerDependencies,
          react: '^16.6.3 || ^17.0.0 || ^18.0.0 || ^19.0.0',
        };
      }

      return pkg;
    },
  },
};
