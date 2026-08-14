import * as React from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface TreeItem {
  value: string;
  label: string;
  searchText?: string;
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  endContent?: React.ReactNode;
  children?: TreeItem[];
}

export type TreeSelection =
  | {
      mode: 'single';
      value: string | null;
      onValueChange: (value: string) => void;
    }
  | {
      mode: 'cascade-multiple';
      values: readonly string[];
      onValuesChange: (values: string[]) => void;
    }
  | {
      mode: 'independent-multiple';
      values: readonly string[];
      onValuesChange: (values: string[]) => void;
    };

interface TreeProps extends Omit<React.ComponentProps<'div'>, 'children'> {
  items: readonly TreeItem[];
  selection: TreeSelection;
  searchQuery?: string;
  emptyText?: string;
  searchEmptyText?: string;
}

type TreeSelectionState = 'checked' | 'indeterminate' | 'unchecked';

interface TreeItemModel {
  item: TreeItem;
  parent?: TreeItemModel;
  children: TreeItemModel[];
  subtreeValues: string[];
}

interface TreeModel {
  roots: TreeItemModel[];
  nodesByValue: ReadonlyMap<string, TreeItemModel>;
  orderedValues: string[];
}

function createTreeModel(items: readonly TreeItem[]): TreeModel {
  const nodesByValue = new Map<string, TreeItemModel>();
  const orderedValues: string[] = [];

  const visit = (item: TreeItem, parent?: TreeItemModel): TreeItemModel => {
    if (nodesByValue.has(item.value)) {
      throw new Error(`Tree item value must be unique: ${item.value}`);
    }

    const node: TreeItemModel = {
      item,
      parent,
      children: [],
      subtreeValues: [item.value]
    };
    nodesByValue.set(item.value, node);
    orderedValues.push(item.value);
    node.children = (item.children ?? []).map((child) => visit(child, node));
    node.subtreeValues = [item.value, ...node.children.flatMap((child) => child.subtreeValues)];
    return node;
  };

  return {
    roots: items.map((item) => visit(item)),
    nodesByValue,
    orderedValues
  };
}

function filterTree(
  nodes: readonly TreeItemModel[],
  normalizedSearchQuery: string
): TreeItemModel[] {
  if (!normalizedSearchQuery) return [...nodes];

  const matches: TreeItemModel[] = [];
  for (const node of nodes) {
    const children = filterTree(node.children, normalizedSearchQuery);
    const searchText = node.item.searchText ?? node.item.label;
    if (searchText.toLocaleLowerCase().includes(normalizedSearchQuery) || children.length > 0) {
      matches.push({ ...node, children });
    }
  }
  return matches;
}

function collectTreeValues(nodes: readonly TreeItemModel[]): Set<string> {
  const values = new Set<string>();
  for (const node of nodes) {
    values.add(node.item.value);
    for (const value of collectTreeValues(node.children)) values.add(value);
  }
  return values;
}

function flattenVisibleTree(
  nodes: readonly TreeItemModel[],
  expandedValues: ReadonlySet<string>,
  forceExpanded: boolean
): TreeItemModel[] {
  const visible: TreeItemModel[] = [];
  for (const node of nodes) {
    visible.push(node);
    if (node.children.length > 0 && (forceExpanded || expandedValues.has(node.item.value))) {
      visible.push(...flattenVisibleTree(node.children, expandedValues, forceExpanded));
    }
  }
  return visible;
}

function getCascadeSelectionState(
  node: TreeItemModel,
  selectedValues: ReadonlySet<string>
): TreeSelectionState {
  let selectedCount = 0;
  for (const value of node.subtreeValues) {
    if (selectedValues.has(value)) selectedCount += 1;
  }

  if (selectedCount === 0) return 'unchecked';
  if (selectedCount === node.subtreeValues.length) return 'checked';
  return 'indeterminate';
}

function getSelectionState(
  node: TreeItemModel,
  selection: TreeSelection,
  selectedValues: ReadonlySet<string>
): TreeSelectionState | undefined {
  if (selection.mode === 'single') return undefined;
  if (selection.mode === 'independent-multiple') {
    return selectedValues.has(node.item.value) ? 'checked' : 'unchecked';
  }
  return getCascadeSelectionState(node, selectedValues);
}

function toggleCascadeSelection(
  node: TreeItemModel,
  state: TreeSelectionState,
  selectedValues: ReadonlySet<string>,
  orderedValues: readonly string[]
): string[] {
  const nextValues = new Set(selectedValues);
  const shouldSelectSubtree = state !== 'checked';

  for (const value of node.subtreeValues) {
    if (shouldSelectSubtree) nextValues.add(value);
    else nextValues.delete(value);
  }

  let ancestor = node.parent;
  while (ancestor) {
    const allDescendantsSelected = ancestor.subtreeValues
      .slice(1)
      .every((value) => nextValues.has(value));
    if (allDescendantsSelected) nextValues.add(ancestor.item.value);
    else nextValues.delete(ancestor.item.value);
    ancestor = ancestor.parent;
  }

  return orderedValues.filter((value) => nextValues.has(value));
}

function multipleSelectionLabel(item: TreeItem, state: TreeSelectionState) {
  const stateLabel =
    state === 'checked' ? '已选中' : state === 'indeterminate' ? '部分选中' : '未选中';
  return `${item.label}，${stateLabel}`;
}

function multipleSelectionAriaState(state: TreeSelectionState): boolean | 'mixed' {
  if (state === 'checked') return true;
  if (state === 'indeterminate') return 'mixed';
  return false;
}

interface TreeNodeProps {
  node: TreeItemModel;
  depth: number;
  index: number;
  siblingCount: number;
  activeValue: string | undefined;
  expandedValues: ReadonlySet<string>;
  forceExpanded: boolean;
  onActiveValueChange: (value: string) => void;
  onItemRef: (value: string, element: HTMLDivElement | null) => void;
  onItemKeyDown: (event: React.KeyboardEvent<HTMLDivElement>, node: TreeItemModel) => void;
  onToggleExpanded: (value: string) => void;
  selection: TreeSelection;
  selectedValues: ReadonlySet<string>;
  model: TreeModel;
}

function TreeNode({
  node,
  depth,
  index,
  siblingCount,
  activeValue,
  expandedValues,
  forceExpanded,
  onActiveValueChange,
  onItemRef,
  onItemKeyDown,
  onToggleExpanded,
  selection,
  selectedValues,
  model
}: TreeNodeProps) {
  const hasChildren = node.children.length > 0;
  const expanded = forceExpanded || expandedValues.has(node.item.value);
  const singleSelected = selection.mode === 'single' && selection.value === node.item.value;
  const selectionState = getSelectionState(node, selection, selectedValues);

  const handleSelect = () => {
    if (selection.mode === 'single') {
      selection.onValueChange(node.item.value);
      return;
    }
    if (selection.mode === 'independent-multiple') {
      const next = new Set(selectedValues);
      if (next.has(node.item.value)) next.delete(node.item.value);
      else next.add(node.item.value);
      selection.onValuesChange(model.orderedValues.filter((value) => next.has(value)));
      return;
    }
    selection.onValuesChange(
      toggleCascadeSelection(node, selectionState!, selectedValues, model.orderedValues)
    );
  };

  const Icon = node.item.icon;
  const ariaLabel = selectionState
    ? multipleSelectionLabel(node.item, selectionState)
    : node.item.label;

  return (
    <>
      <div
        ref={(element) => onItemRef(node.item.value, element)}
        role='treeitem'
        tabIndex={activeValue === node.item.value ? 0 : -1}
        aria-label={ariaLabel}
        aria-level={depth + 1}
        aria-posinset={index + 1}
        aria-setsize={siblingCount}
        aria-expanded={hasChildren ? expanded : undefined}
        aria-selected={selection.mode === 'single' ? singleSelected : undefined}
        aria-checked={selectionState ? multipleSelectionAriaState(selectionState) : undefined}
        className={cn(
          'group flex w-full min-w-0 cursor-pointer items-center overflow-hidden rounded outline-none focus-visible:ring-2 focus-visible:ring-ring',
          singleSelected ? 'bg-accent' : 'hover:bg-accent/60'
        )}
        style={{ paddingLeft: `${depth}rem` }}
        onClick={handleSelect}
        onFocus={() => onActiveValueChange(node.item.value)}
        onKeyDown={(event) => onItemKeyDown(event, node)}
      >
        {hasChildren && !forceExpanded ? (
          <Button
            type='button'
            variant='ghost'
            size='icon'
            tabIndex={-1}
            data-tree-expander=''
            className='size-6 shrink-0 text-muted-foreground'
            aria-label={expanded ? `收起${node.item.label}` : `展开${node.item.label}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpanded(node.item.value);
            }}
          >
            {expanded ? (
              <Icons.chevronDown className='size-4' />
            ) : (
              <Icons.chevronRight className='size-4' />
            )}
          </Button>
        ) : hasChildren ? (
          <span
            aria-hidden
            className='inline-flex size-6 shrink-0 items-center justify-center text-muted-foreground'
          >
            <Icons.chevronDown className='size-4' />
          </span>
        ) : (
          <span className='size-6 shrink-0' aria-hidden />
        )}
        <span
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1 text-left text-sm',
            singleSelected ? 'font-medium text-accent-foreground' : 'text-foreground/90'
          )}
        >
          {selectionState ? (
            <span
              aria-hidden
              data-tree-selection-state={selectionState}
              className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded-sm border border-primary',
                selectionState === 'unchecked' ? 'opacity-50 [&_svg]:invisible' : 'bg-primary'
              )}
            >
              {selectionState === 'indeterminate' ? (
                <Icons.minus className='size-4 text-primary-foreground' />
              ) : (
                <Icons.check className='size-4 text-primary-foreground' />
              )}
            </span>
          ) : null}
          {Icon ? <Icon className='size-4 shrink-0' /> : null}
          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <span className='min-w-0 flex-1 truncate'>{node.item.label}</span>
            </TooltipTrigger>
            <TooltipContent side='right' className='max-w-80 break-words'>
              {node.item.label}
            </TooltipContent>
          </Tooltip>
          {node.item.endContent}
        </span>
      </div>
      {hasChildren && expanded
        ? node.children.map((child, childIndex) => (
            <TreeNode
              key={child.item.value}
              node={child}
              depth={depth + 1}
              index={childIndex}
              siblingCount={node.children.length}
              activeValue={activeValue}
              expandedValues={expandedValues}
              forceExpanded={forceExpanded}
              onActiveValueChange={onActiveValueChange}
              onItemRef={onItemRef}
              onItemKeyDown={onItemKeyDown}
              onToggleExpanded={onToggleExpanded}
              selection={selection}
              selectedValues={selectedValues}
              model={model}
            />
          ))
        : null}
    </>
  );
}

export function Tree({
  items,
  selection,
  searchQuery = '',
  emptyText = '暂无数据',
  searchEmptyText = '未找到匹配项',
  className,
  ...props
}: TreeProps) {
  const model = React.useMemo(() => createTreeModel(items), [items]);
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const visibleRoots = React.useMemo(
    () => filterTree(model.roots, normalizedSearchQuery),
    [model.roots, normalizedSearchQuery]
  );
  const [expandedValues, setExpandedValues] = React.useState<ReadonlySet<string>>(() =>
    collectTreeValues(model.roots)
  );
  const multipleValues =
    selection.mode === 'cascade-multiple' || selection.mode === 'independent-multiple'
      ? selection.values
      : undefined;
  const singleValue = selection.mode === 'single' ? selection.value : null;
  const selectedValues = React.useMemo(() => new Set(multipleValues ?? []), [multipleValues]);
  const forceExpanded = Boolean(normalizedSearchQuery);
  const visibleNodes = React.useMemo(
    () => flattenVisibleTree(visibleRoots, expandedValues, forceExpanded),
    [expandedValues, forceExpanded, visibleRoots]
  );
  const visibleValueSet = React.useMemo(
    () => new Set(visibleNodes.map((node) => node.item.value)),
    [visibleNodes]
  );
  const [requestedActiveValue, setRequestedActiveValue] = React.useState<string | null>(null);
  const preferredSelectedValue =
    singleValue && visibleValueSet.has(singleValue)
      ? singleValue
      : multipleValues?.find((value) => visibleValueSet.has(value));
  const activeValue =
    requestedActiveValue && visibleValueSet.has(requestedActiveValue)
      ? requestedActiveValue
      : (preferredSelectedValue ?? visibleNodes[0]?.item.value);
  const itemRefs = React.useRef(new Map<string, HTMLDivElement>());
  const [focusRequest, setFocusRequest] = React.useState<string | null>(null);

  React.useLayoutEffect(() => {
    if (!focusRequest) return;
    itemRefs.current.get(focusRequest)?.focus();
    setFocusRequest(null);
  }, [focusRequest, visibleNodes]);

  React.useEffect(() => {
    if (!singleValue) return;
    const selectedNode = model.nodesByValue.get(singleValue);
    if (!selectedNode) return;

    setExpandedValues((previous) => {
      const next = new Set(previous);
      let ancestor = selectedNode.parent;
      while (ancestor) {
        next.add(ancestor.item.value);
        ancestor = ancestor.parent;
      }
      return next.size === previous.size ? previous : next;
    });
  }, [model.nodesByValue, singleValue]);

  const handleToggleExpanded = React.useCallback((value: string) => {
    setExpandedValues((previous) => {
      const next = new Set(previous);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }, []);

  const requestFocus = React.useCallback((value: string | undefined) => {
    if (!value) return;
    setRequestedActiveValue(value);
    setFocusRequest(value);
  }, []);

  const handleItemRef = React.useCallback((value: string, element: HTMLDivElement | null) => {
    if (element) itemRefs.current.set(value, element);
    else itemRefs.current.delete(value);
  }, []);

  const handleItemKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, node: TreeItemModel) => {
      const currentIndex = visibleNodes.findIndex(
        (visibleNode) => visibleNode.item.value === node.item.value
      );
      if (currentIndex < 0) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          requestFocus(visibleNodes[currentIndex + 1]?.item.value);
          return;
        case 'ArrowUp':
          event.preventDefault();
          requestFocus(visibleNodes[currentIndex - 1]?.item.value);
          return;
        case 'Home':
          event.preventDefault();
          requestFocus(visibleNodes[0]?.item.value);
          return;
        case 'End':
          event.preventDefault();
          requestFocus(visibleNodes.at(-1)?.item.value);
          return;
        case 'ArrowRight':
          if (node.children.length === 0) return;
          event.preventDefault();
          if (!forceExpanded && !expandedValues.has(node.item.value)) {
            handleToggleExpanded(node.item.value);
          } else {
            requestFocus(node.children[0]?.item.value);
          }
          return;
        case 'ArrowLeft':
          event.preventDefault();
          if (!forceExpanded && node.children.length > 0 && expandedValues.has(node.item.value)) {
            handleToggleExpanded(node.item.value);
          } else {
            requestFocus(node.parent?.item.value);
          }
          return;
        case 'Enter':
        case ' ':
          event.preventDefault();
          event.currentTarget.click();
          return;
      }
    },
    [expandedValues, forceExpanded, handleToggleExpanded, requestFocus, visibleNodes]
  );

  if (visibleRoots.length === 0) {
    return (
      <div className='py-8 text-center text-sm text-muted-foreground' role='status'>
        {normalizedSearchQuery ? searchEmptyText : emptyText}
      </div>
    );
  }

  return (
    <div
      role='tree'
      aria-multiselectable={
        selection.mode === 'cascade-multiple' || selection.mode === 'independent-multiple'
          ? true
          : undefined
      }
      className={cn('flex w-full min-w-0 flex-col gap-0.5 overflow-hidden', className)}
      {...props}
    >
      {visibleRoots.map((node, index) => (
        <TreeNode
          key={node.item.value}
          node={node}
          depth={0}
          index={index}
          siblingCount={visibleRoots.length}
          activeValue={activeValue}
          expandedValues={expandedValues}
          forceExpanded={forceExpanded}
          onActiveValueChange={setRequestedActiveValue}
          onItemRef={handleItemRef}
          onItemKeyDown={handleItemKeyDown}
          onToggleExpanded={handleToggleExpanded}
          selection={selection}
          selectedValues={selectedValues}
          model={model}
        />
      ))}
    </div>
  );
}
