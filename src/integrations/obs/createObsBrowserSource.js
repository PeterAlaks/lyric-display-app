import { getTransparentBrowserCss } from '@/integrations/sourceUrls';
import { pickBrowserSourceKind } from './obsWebSocketClient';

const TRANSFORM_BOUNDS_TYPES = {
  stretch: 'OBS_BOUNDS_STRETCH',
  fit: 'OBS_BOUNDS_SCALE_INNER',
  fill: 'OBS_BOUNDS_SCALE_OUTER',
  width: 'OBS_BOUNDS_SCALE_TO_WIDTH',
  height: 'OBS_BOUNDS_SCALE_TO_HEIGHT',
};

export function createBrowserSourceSettings({ url, width, height, fps, transparent = true }) {
  return {
    url,
    width,
    height,
    fps,
    css: transparent ? getTransparentBrowserCss() : '',
    shutdown: true,
    restart_when_active: false,
  };
}

export async function createOrUpdateObsBrowserSource({
  client,
  sceneName,
  sourceName,
  sourceUrl,
  width,
  height,
  fps = 30,
  transparent = true,
  transformMode = 'stretch',
  lockSource = true,
}) {
  const [inputKindResult, inputListResult] = await Promise.all([
    client.getInputKindList(),
    client.getInputList(),
  ]);

  const inputKinds = inputKindResult.inputKinds || [];
  const browserSourceKind = pickBrowserSourceKind(inputKinds);

  if (!browserSourceKind) {
    throw new Error('OBS Browser Source is not available. Install or enable the OBS Browser Source plugin.');
  }

  const existingInput = (inputListResult.inputs || []).find((input) => input.inputName === sourceName);
  const inputSettings = createBrowserSourceSettings({
    url: sourceUrl,
    width,
    height,
    fps,
    transparent,
  });

  let sceneItemId = null;
  let action = 'created';

  if (existingInput) {
    await client.setInputSettings({
      inputName: sourceName,
      inputSettings,
      overlay: true,
    });
    action = 'updated';

    try {
      const sceneItem = await client.getSceneItemId({ sceneName, sourceName });
      sceneItemId = sceneItem.sceneItemId;
    } catch {
      const createdSceneItem = await client.createSceneItem({ sceneName, sourceName });
      sceneItemId = createdSceneItem.sceneItemId;
      action = 'updated-and-added';
    }
  } else {
    const created = await client.createInput({
      sceneName,
      inputName: sourceName,
      inputKind: browserSourceKind,
      inputSettings,
    });
    sceneItemId = created.sceneItemId;
  }

  const boundsType = TRANSFORM_BOUNDS_TYPES[transformMode] || null;
  if (sceneItemId != null && boundsType) {
    await client.setSceneItemTransform({
      sceneName,
      sceneItemId,
      width,
      height,
      boundsType,
    });
  }

  if (sceneItemId != null && lockSource) {
    await client.setSceneItemLocked({
      sceneName,
      sceneItemId,
      locked: true,
    });
  }

  return {
    action,
    inputKind: existingInput?.inputKind || browserSourceKind,
    sceneItemId,
  };
}
