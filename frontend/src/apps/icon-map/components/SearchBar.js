import { getIcon } from '@utils/Icons.js';

/**
 * SearchBar Component
 * Search input with category filter
 */
export class SearchBar {
    constructor(container, callbacks) {
        this.container = container;
        this.callbacks = callbacks || {};
        this.searchQuery = '';
        this.selectedCategory = 'all';

        this.render();
        this.setupEventListeners();

        console.log('SearchBar component initialized');
    }

    /**
     * Render search bar HTML
     */
    render() {
        this.container.innerHTML = `
            <div class="icon-map-search-bar">
                <div class="search-input-wrapper">
                    <span class="search-icon">${getIcon('search', 20)}</span>
                    <input 
                        type="text" 
                        class="search-input" 
                        placeholder="Search icons by name or category..."
                        autocomplete="off"
                    />
                    <button class="clear-search" title="Clear search" style="display: none;">
                        <span>${getIcon('clear', 16)}</span>
                    </button>
                </div>
                
                <div class="category-filter">
                    <select class="category-select">
                        <option value="all">All Categories</option>
                        <option value="UI Icons">UI Icons</option>
                        <option value="Context Menu">Context Menu</option>
                        <option value="File Types">File Types</option>
                        <option value="System">System</option>
                        <option value="Process Monitor">Process Monitor</option>
                    </select>
                </div>
            </div>
        `;

        this.searchInput = this.container.querySelector('.search-input');
        this.clearBtn = this.container.querySelector('.clear-search');
        this.categorySelect = this.container.querySelector('.category-select');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        this.searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.updateClearButton();
            this.notifyChange();
        });

        this.clearBtn.addEventListener('click', () => {
            this.searchInput.value = '';
            this.searchQuery = '';
            this.updateClearButton();
            this.searchInput.focus();
            this.notifyChange();
        });

        this.categorySelect.addEventListener('change', (e) => {
            this.selectedCategory = e.target.value;
            this.notifyChange();
        });

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                this.searchInput.focus();
                this.searchInput.select();
            }

            if (e.key === 'Escape' && this.searchQuery) {
                this.searchInput.value = '';
                this.searchQuery = '';
                this.updateClearButton();
                this.notifyChange();
            }
        });
    }

    /**
     * Update clear button visibility
     */
    updateClearButton() {
        if (this.searchQuery.length > 0) {
            this.clearBtn.style.display = 'flex';
        } else {
            this.clearBtn.style.display = 'none';
        }
    }

    /**
     * Notify parent about changes
     */
    notifyChange() {
        if (this.callbacks.onChange) {
            this.callbacks.onChange({
                query: this.searchQuery,
                category: this.selectedCategory
            });
        }
    }

    /**
     * Get current search query
     */
    getQuery() {
        return this.searchQuery;
    }

    /**
     * Get current category
     */
    getCategory() {
        return this.selectedCategory;
    }

    /**
     * Focus search input
     */
    focus() {
        this.searchInput.focus();
    }

    /**
     * Cleanup
     */
    destroy() {
        console.log('SearchBar component destroyed');
    }
}