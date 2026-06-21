import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { readSnapshot } from './snapshot';
import { renderWidgetByName } from './render';

// Berjalan di konteks headless JS saat sistem memicu widget (ditambah, update
// berkala, klik, resize). Cukup baca snapshot lalu render — tidak menyentuh DB.
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  if (props.widgetAction === 'WIDGET_DELETED') return;
  const snap = await readSnapshot();
  props.renderWidget(renderWidgetByName(props.widgetInfo.widgetName, snap));
}
