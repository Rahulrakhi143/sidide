# Multi-Tab Editing Implementation - Part 2

## Status: IN PROGRESS

### ✅ Completed:
1. Created `TabBar.tsx` component with:
   - File icons based on extension
   - Close buttons
   - Unsaved changes indicator (yellow dot)
   - Active tab highlighting
   - Hover effects

2. Updated `OSContext.tsx`:
   - Added `openTabs` array to state
   - Added `OPEN_TAB`, `CLOSE_TAB`, `CLOSE_ALL_TABS` actions
   - Implemented reducer logic for tab management
   - Added `openTab`, `closeTab`, `closeAllTabs` functions
   - Exported `FileSystemNode` type

3. Started updating `CodeEditor.tsx`:
   - Imported TabBar component
   - Added dirty tabs state tracking
   - Added openTab and closeTab from context

### 🔄 Next Steps:

#### 1. Update CodeEditor.tsx - Add Tab Logic

Add these useEffects after the existing ones (around line 40):

```typescript
// Track dirty state when content changes
useEffect(() => {
  if (currentFile && content !== originalContent) {
    setDirtyTabs(prev => new Set(prev).add(currentFile.id));
    setIsDirty(true);
  } else if (currentFile) {
    setDirtyTabs(prev => {
      const newSet = new Set(prev);
      newSet.delete(currentFile.id);
      return newSet;
    });
    setIsDirty(false);
  }
}, [content, originalContent, currentFile]);

// Load file content and track original
useEffect(() => {
  if (currentFile && currentFile.type === 'file') {
    const fileContent = currentFile.content || '';
    setContent(fileContent);
    setOriginalContent(fileContent);
  }
}, [currentFile]);

// Keyboard shortcut for tab switching (Ctrl+Tab)
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+Tab - Next tab
    if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const currentIndex = state.openTabs.findIndex(tab => tab.id === currentFile?.id);
      if (currentIndex !== -1 && state.openTabs.length > 1) {
        const nextIndex = (currentIndex + 1) % state.openTabs.length;
        openTab(state.openTabs[nextIndex]);
      }
    }
    // Ctrl+Shift+Tab - Previous tab
    else if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
      e.preventDefault();
      const currentIndex = state.openTabs.findIndex(tab => tab.id === currentFile?.id);
      if (currentIndex !== -1 && state.openTabs.length > 1) {
        const nextIndex = currentIndex === 0 ? state.openTabs.length - 1 : currentIndex - 1;
        openTab(state.openTabs[nextIndex]);
      }
    }
    // Ctrl+W - Close current tab
    else if (e.ctrlKey && e.key === 'w') {
      e.preventDefault();
      if (currentFile) {
        handleTabClose(currentFile, e as any);
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [state.openTabs, currentFile, openTab]);
```

#### 2. Add Tab Handlers

Add these handler functions before the return statement:

```typescript
const handleTabClick = (file: FileSystemNode) => {
  openTab(file);
};

const handleTabClose = (file: FileSystemNode, e: React.MouseEvent) => {
  e.stopPropagation();
  
  // Check if file has unsaved changes
  if (dirtyTabs.has(file.id)) {
    const confirmClose = window.confirm(
      `"${file.name}" has unsaved changes. Close anyway?`
    );
    if (!confirmClose) return;
  }
  
  closeTab(file.id);
  
  // Remove from dirty tabs
  setDirtyTabs(prev => {
    const newSet = new Set(prev);
    newSet.delete(file.id);
    return newSet;
  });
};
```

#### 3. Update handleSave Function

Find the `handleSave` function and update it to clear dirty state:

```typescript
const handleSave = () => {
  if (currentFile && currentFile.type === 'file') {
    updateFileContent(currentFile.id, content);
    setOriginalContent(content); // Update original content
    setIsDirty(false);
    
    // Remove from dirty tabs
    setDirtyTabs(prev => {
      const newSet = new Set(prev);
      newSet.delete(currentFile.id);
      return newSet;
    });
    
    // Show toast notification
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-green-900 text-green-300 px-3 py-2 rounded text-sm z-50';
    toast.textContent = `Saved ${currentFile.name}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }
};
```

#### 4. Render TabBar

Find the return statement and add TabBar before the editor content (around line 430):

```typescript
return (
  <div className="h-full flex flex-col bg-gradient-to-b from-gray-900/90 to-black/90">
    {/* Tab Bar */}
    <TabBar
      tabs={state.openTabs}
      activeTabId={currentFile?.id || null}
      onTabClick={handleTabClick}
      onTabClose={handleTabClose}
      dirtyTabs={dirtyTabs}
    />
    
    {/* Rest of the editor content... */}
```

### 5. Update FileExplorer.tsx

The FileExplorer needs to call `openTab` instead of `setActiveFile`:

Find where files are clicked (search for `setActiveFile`) and replace with:

```typescript
// In FileExplorer.tsx
const { openTab } = useOS(); // Add to destructuring

// When file is clicked:
if (node.type === 'file') {
  openTab(node); // Instead of setActiveFile(node)
}
```

### Testing Checklist:

- [ ] Click file in explorer opens new tab
- [ ] Click existing tab switches to it
- [ ] Close button closes tab
- [ ] Unsaved changes show yellow dot
- [ ] Confirm dialog on close with unsaved changes
- [ ] Ctrl+Tab switches to next tab
- [ ] Ctrl+Shift+Tab switches to previous tab
- [ ] Ctrl+W closes current tab
- [ ] Saving file clears dirty indicator
- [ ] Closing active tab switches to another tab
- [ ] Last tab close shows "No File Selected"

### Known Issues to Address:

1. Need to update FileExplorer to use openTab
2. Consider adding "Close All" and "Close Others" context menu
3. Add tab reordering (drag & drop) in future iteration
4. Consider max tabs limit (e.g., 20 tabs)

### Files Modified:

1. ✅ `src/components/TabBar.tsx` - NEW
2. ✅ `src/context/OSContext.tsx` - UPDATED
3. 🔄 `src/components/CodeEditor.tsx` - IN PROGRESS
4. ⏳ `src/components/FileExplorer.tsx` - PENDING

---

**Continue with the steps above to complete the implementation!**
