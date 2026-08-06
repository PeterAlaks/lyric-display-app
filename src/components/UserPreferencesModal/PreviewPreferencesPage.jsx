import React from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import useLyricsStore from '@/context/LyricsStore';
import { useCustomOutputIds } from '@/hooks/useStoreSelectors';
import { formatOutputLabel } from '@/utils/outputLabels';
import {
  getAvailablePreviewItemIds,
  normalizePreviewSettings,
  resolvePreviewItemOrder,
} from '../../../shared/previewSettings.js';

const PREVIEW_DROP_ANIMATION = {
  duration: 180,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
};

const PreviewOrderCard = ({
  active = false,
  attributes,
  darkMode,
  index,
  isDragOverlay = false,
  isDragging = false,
  itemId,
  labelClass,
  listeners,
  mutedClass,
  nodeRef,
  activatorNodeRef,
  style,
}) => (
  <div
    ref={nodeRef}
    style={style}
    className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-[background-color,border-color,box-shadow,opacity] duration-150 ${darkMode
      ? 'border-gray-700 bg-gray-900/70'
      : 'border-gray-200 bg-gray-50'
    } ${active && !isDragging ? 'ring-2 ring-blue-400/70 ring-offset-1 ring-offset-transparent' : ''} ${
      isDragOverlay ? 'pointer-events-none scale-[1.01] cursor-grabbing shadow-2xl' : ''
    }`}
  >
    <button
      type="button"
      ref={activatorNodeRef}
      aria-label={`Drag ${formatOutputLabel(itemId)} to reorder`}
      title="Drag to reorder"
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${darkMode
        ? 'text-gray-500 hover:bg-blue-500/10 hover:text-blue-300'
        : 'text-gray-400 hover:bg-blue-50 hover:text-blue-600'
      } ${isDragOverlay ? 'cursor-grabbing' : 'cursor-grab active:cursor-grabbing'}`}
      {...(!isDragOverlay ? attributes : {})}
      {...(!isDragOverlay ? listeners : {})}
    >
      <GripVertical className="h-4 w-4" />
    </button>
    <span className={`w-5 shrink-0 text-xs tabular-nums ${mutedClass}`}>{index + 1}</span>
    <div className="min-w-0 flex-1">
      <div className={`truncate text-sm font-medium ${labelClass}`}>{formatOutputLabel(itemId)}</div>
      <div className={`truncate text-[11px] ${mutedClass}`}>/{itemId}</div>
    </div>
  </div>
);

const SortablePreviewOrderCard = (props) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.itemId });

  return (
    <PreviewOrderCard
      {...props}
      active={props.active}
      attributes={attributes}
      listeners={listeners}
      nodeRef={setNodeRef}
      activatorNodeRef={setActivatorNodeRef}
      isDragging={isDragging}
      style={{
        transform: transform ? CSS.Transform.toString(transform) : undefined,
        transition: transition || undefined,
        opacity: isDragging ? 0.28 : undefined,
        willChange: transform ? 'transform' : undefined,
      }}
    />
  );
};

const PreviewPreferencesPage = ({
  darkMode,
  inputClass,
  labelClass,
  mutedClass,
  onBack,
  preferences,
  selectContentClass,
  updatePreference,
}) => {
  const customOutputIds = useCustomOutputIds();
  const settings = normalizePreviewSettings(preferences.appearance?.preview);
  const availableItemIds = getAvailablePreviewItemIds(customOutputIds);
  const orderedItemIds = resolvePreviewItemOrder(settings.order, availableItemIds);
  const [activeId, setActiveId] = React.useState(null);
  const [activeOverlayWidth, setActiveOverlayWidth] = React.useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const saveSettings = (partial) => {
    const nextSettings = normalizePreviewSettings({
      ...settings,
      ...partial,
    });
    useLyricsStore.getState().setPreviewSettings(nextSettings);
    updatePreference('appearance', 'preview', nextSettings);
  };

  const handleDragStart = ({ active }) => {
    setActiveId(active?.id ?? null);
    setActiveOverlayWidth(active?.rect?.current?.initial?.width ?? null);
  };

  const clearActiveDrag = () => {
    setActiveId(null);
    setActiveOverlayWidth(null);
  };

  const handleDragEnd = ({ active, over }) => {
    clearActiveDrag();
    if (!over || !active || active.id === over.id) return;

    const fromIndex = orderedItemIds.indexOf(active.id);
    const toIndex = orderedItemIds.indexOf(over.id);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

    saveSettings({ order: arrayMove(orderedItemIds, fromIndex, toIndex) });
  };

  const activeIndex = activeId ? orderedItemIds.indexOf(activeId) : -1;
  const dragOverlay = activeId && activeIndex >= 0 ? (
    <DragOverlay adjustScale={false} dropAnimation={PREVIEW_DROP_ANIMATION}>
      <PreviewOrderCard
        darkMode={darkMode}
        index={activeIndex}
        isDragOverlay
        itemId={activeId}
        labelClass={labelClass}
        mutedClass={mutedClass}
        style={{ width: activeOverlayWidth ? `${activeOverlayWidth}px` : undefined }}
      />
    </DragOverlay>
  ) : null;

  const switchClassName = `!h-7 !w-14 !border-0 shadow-sm transition-colors ${darkMode
    ? 'data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-gray-600'
    : 'data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-300'
  }`;

  return (
    <div>
      <div className="mb-5 flex min-w-0 items-center gap-2">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onBack}
          aria-label="Back from Preview"
          className="h-7 w-7 shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <div className="min-w-0">
          <h3 className={`truncate text-base font-semibold ${labelClass}`}>Preview</h3>
          <p className={`text-[11px] ${mutedClass}`}>Arrange feeds and tune the operator display</p>
        </div>
      </div>

      <div className="space-y-6">
        <section className="space-y-3">
          <div>
            <h4 className={`text-sm font-medium ${labelClass}`}>Feed order</h4>
            <p className={`mt-0.5 text-xs ${mutedClass}`}>
              Drag feeds into the order they should fill the grid.
            </p>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={clearActiveDrag}
          >
            <SortableContext items={orderedItemIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {orderedItemIds.map((itemId, index) => (
                  <SortablePreviewOrderCard
                    key={itemId}
                    active={activeId === itemId}
                    darkMode={darkMode}
                    index={index}
                    itemId={itemId}
                    labelClass={labelClass}
                    mutedClass={mutedClass}
                  />
                ))}
              </div>
            </SortableContext>
            {typeof document !== 'undefined' && dragOverlay
              ? createPortal(dragOverlay, document.body)
              : dragOverlay}
          </DndContext>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className={`block text-xs font-medium ${labelClass}`}>Grid style</span>
            <Select value={settings.gridStyle} onValueChange={(value) => saveSettings({ gridStyle: value })}>
              <SelectTrigger className={inputClass} aria-label="Preview grid style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={selectContentClass}>
                <SelectItem value="featured">Featured pair</SelectItem>
                <SelectItem value="responsive">Responsive</SelectItem>
              </SelectContent>
            </Select>
            <p className={`text-xs ${mutedClass}`}>
              {settings.gridStyle === 'featured'
                ? 'Two feeds on top, then up to three per row.'
                : 'Fill each row with up to three feeds from the start.'}
            </p>
          </label>

          <label className="space-y-1.5">
            <span className={`block text-xs font-medium ${labelClass}`}>Frame spacing</span>
            <Select value={settings.gap} onValueChange={(value) => saveSettings({ gap: value })}>
              <SelectTrigger className={inputClass} aria-label="Preview frame spacing">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={selectContentClass}>
                <SelectItem value="comfortable">Comfortable</SelectItem>
                <SelectItem value="compact">Compact</SelectItem>
              </SelectContent>
            </Select>
          </label>

          <label className="space-y-1.5 sm:col-span-2">
            <span className={`block text-xs font-medium ${labelClass}`}>Preview rendering</span>
            <Select
              value={settings.previewResolution}
              onValueChange={(value) => saveSettings({ previewResolution: value })}
            >
              <SelectTrigger className={inputClass} aria-label="Preview rendering resolution">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={selectContentClass}>
                <SelectItem value="720p">Efficient · 1280 × 720 per feed</SelectItem>
                <SelectItem value="1080p">Full detail · 1920 × 1080 per feed</SelectItem>
              </SelectContent>
            </Select>
            <p className={`text-xs ${mutedClass}`}>Efficient rendering is recommended when monitoring several feeds.</p>
          </label>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-6">
            <div className="min-w-0 flex-1">
              <label className={`text-sm font-medium ${labelClass}`}>Show operator header</label>
              <p className={`text-xs ${mutedClass}`}>Display connection state, feed count, clock, and refresh action</p>
            </div>
            <Switch
              checked={settings.showHeader}
              onCheckedChange={(checked) => saveSettings({ showHeader: checked })}
              className={switchClassName}
              thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
            />
          </div>

          <div className="flex items-center justify-between gap-6">
            <div className="min-w-0 flex-1">
              <label className={`text-sm font-medium ${labelClass}`}>Show output labels</label>
              <p className={`text-xs ${mutedClass}`}>Overlay a compact identifier in the top-left of each frame</p>
            </div>
            <Switch
              checked={settings.showLabels}
              onCheckedChange={(checked) => saveSettings({ showLabels: checked })}
              className={switchClassName}
              thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
            />
          </div>

          <div className={`flex items-center justify-between gap-6 ${settings.showLabels ? '' : 'opacity-50'}`}>
            <div className="min-w-0 flex-1">
              <label className={`text-sm font-medium ${labelClass}`}>Show route paths</label>
              <p className={`text-xs ${mutedClass}`}>Include the source route inside each output label</p>
            </div>
            <Switch
              checked={settings.showRoutePaths}
              disabled={!settings.showLabels}
              onCheckedChange={(checked) => saveSettings({ showRoutePaths: checked })}
              className={switchClassName}
              thumbClassName="!h-5 !w-6 data-[state=checked]:!translate-x-7 data-[state=unchecked]:!translate-x-1"
            />
          </div>
        </section>
      </div>
    </div>
  );
};

export default PreviewPreferencesPage;
