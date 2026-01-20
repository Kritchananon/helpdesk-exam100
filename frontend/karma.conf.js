module.exports = function(config) {
  config.set({
    frameworks: ['jasmine', '@angular-devkit/build-angular'],

    // ใช้ Edge แบบกำหนดเอง
    browsers: ['EdgeCustom'],

    customLaunchers: {
      EdgeCustom: {
        base: 'Edge',
        command: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', // << แก้ KEY ให้ถูก
        flags: ['--disable-gpu', '--remote-allow-origins=*']
      }
    },

    plugins: [
      require('karma-jasmine'),
      require('karma-edge-launcher'),
      require('karma-jasmine-html-reporter'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],

    client: { clearContext: false },

    singleRun: false,
    autoWatch: true
  });
};
