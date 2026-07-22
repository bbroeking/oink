/**
 * Expo 52's autolinker can resolve ExpoModulesPackage using its pre-modules
 * namespace when invoked through Gradle. Keep the generated Android package
 * list aligned with the class shipped by the installed Expo package.
 */
module.exports = {
  dependencies: {
    expo: {
      platforms: {
        android: {
          packageImportPath: 'import expo.modules.ExpoModulesPackage;',
          packageInstance: 'new ExpoModulesPackage()',
        },
      },
    },
  },
};
