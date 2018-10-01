const gulp = require('gulp');
const { exec } = require('child_process');

gulp.task('default', () => {
  // place code for your default task here
});

gulp.task('local-db', () => {
  exec('sudo docker run -d redis', (err) => {
    if (err) {
      console.log(err);
    }
  });
});
