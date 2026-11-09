const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const webDir = path.join(root, 'www');
const files = ['index.html', 'styles.css', 'app.js', 'icon.svg'];

fs.rmSync(webDir, { recursive: true, force: true });
fs.mkdirSync(webDir, { recursive: true });
for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(webDir, file));
}

const androidRoot = path.join(root, 'android');
if (fs.existsSync(androidRoot)) {
  const widgetRoot = path.join(root, 'android-widget');
  const javaDestination = path.join(
    androidRoot,
    'app',
    'src',
    'main',
    'java',
    'com',
    'sonora',
    'musicplayer'
  );
  const receiverDestination = path.join(
    androidRoot,
    'app',
    'src',
    'main',
    'res',
    'xml'
  );
  const layoutDestination = path.join(
    androidRoot,
    'app',
    'src',
    'main',
    'res',
    'layout'
  );
  const drawableDestination = path.join(
    androidRoot,
    'app',
    'src',
    'main',
    'res',
    'drawable'
  );
  fs.mkdirSync(javaDestination, { recursive: true });
  fs.mkdirSync(receiverDestination, { recursive: true });
  fs.mkdirSync(layoutDestination, { recursive: true });
  fs.mkdirSync(drawableDestination, { recursive: true });
  fs.copyFileSync(
    path.join(widgetRoot, 'MainActivity.java'),
    path.join(javaDestination, 'MainActivity.java')
  );
  fs.copyFileSync(
    path.join(widgetRoot, 'SonoraWidgetProvider.java'),
    path.join(javaDestination, 'SonoraWidgetProvider.java')
  );
  fs.copyFileSync(
    path.join(widgetRoot, 'sonora_widget_info.xml'),
    path.join(receiverDestination, 'sonora_widget_info.xml')
  );
  fs.copyFileSync(
    path.join(widgetRoot, 'sonora_widget.xml'),
    path.join(layoutDestination, 'sonora_widget.xml')
  );
  fs.copyFileSync(
    path.join(widgetRoot, 'sonora_widget_background.xml'),
    path.join(drawableDestination, 'sonora_widget_background.xml')
  );

  const manifestPath = path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml');
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  const receiver = `
        <receiver
            android:name=".SonoraWidgetProvider"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/sonora_widget_info" />
        </receiver>
`;
  if (!manifest.includes('android:name=".SonoraWidgetProvider"')) {
    manifest = manifest.replace('    </application>', `${receiver}    </application>`);
    fs.writeFileSync(manifestPath, manifest);
  }
}
