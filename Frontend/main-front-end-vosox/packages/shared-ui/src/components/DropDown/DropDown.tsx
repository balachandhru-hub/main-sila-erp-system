import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FC,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { createPortal } from "react-dom";
 
import {
  FaChevronDown,
  FaExclamationCircle,
  FaInfoCircle,
  FaSpinner,
  FaTimes,
} from "react-icons/fa";
 
import type {
  DropdownOption,
  DropdownProps,
  DropdownValue,
} from "./DropDown.types";
 
import "./DropDown.css";
 
/*
 * Menu placement.
 * The menu is portalled to <body> and positioned against the field, so a scrolling or
 * overflow-hidden ancestor (a table wrapper, a card, a modal body) can never clip it.
 */
const MENU_MAX_HEIGHT = 300;
const MENU_MIN_HEIGHT = 120;
const MENU_GAP = 6;
const VIEWPORT_MARGIN = 8;

interface CachedPage {
  options: DropdownOption[];
  hasMore: boolean;
}
 
interface DropdownCache {
  pages: Record<number, CachedPage>;
}
 
const Dropdown: FC<DropdownProps> = (props) => {
  const {
    label,
    hideLabel = false,
    isRequired = false,
    value = null,
    options = [],
    isAsync = false,
    loadOptions,
    params,
    debounceDelay = 300,
    placeholder = "Select...",
    error,
    infoText,
    isClearable = false,
    isDisable = false,
    cacheUniques,
    className = "",
    style,
  } = props;
 
  const isMulti = props.isMulti === true;
 
  const dropdownRef =
    useRef<HTMLDivElement>(null);

  const fieldWrapperRef =
    useRef<HTMLDivElement>(null);

  const menuRef =
    useRef<HTMLDivElement>(null);

  const optionsRef =
    useRef<HTMLDivElement>(null);
 
  const inputRef =
    useRef<HTMLInputElement>(null);
 
  const selectedTagsRef =
    useRef<HTMLDivElement>(null);
 
  const debounceRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );
 
  const requestIdRef = useRef(0);
 
  /** Holds the previously seen cacheUniques key, or `false` before the first run. */
  const cacheInitializedRef =
    useRef<string | false>(false);
 
  const loadingPagesRef =
    useRef<Set<string>>(new Set());

  const wasOpenRef =
    useRef(false);

  /*
   * Async cache.
   *
   * Cache structure:
   *
   * {
   *   "search|dependency": {
   *     pages: {
   *       0: {
   *         options: [...],
   *         hasMore: true
   *       },
   *       1: {
   *         options: [...],
   *         hasMore: false
   *       }
   *     }
   *   }
   * }
   */
  const [optionCache, setOptionCache] =
    useState<
      Record<string, DropdownCache>
    >({});
 
  const [isOpen, setIsOpen] =
    useState(false);
 
  const [search, setSearch] =
    useState("");
 
  /*
   * The currently visible async options.
   *
   * This is rebuilt from the cache.
   */
  const [asyncOptions, setAsyncOptions] =
    useState<DropdownOption[]>([]);
 
  const [page, setPage] =
    useState(0);
 
  const [hasMore, setHasMore] =
    useState(false);
 
  const [loading, setLoading] =
    useState(false);
 
  const hasError = Boolean(error);
 
  /*
   * Narrow onChange based on isMulti.
   */
  const singleOnChange =
    !isMulti
      ? (
          props as Extract<
            DropdownProps,
            { isMulti?: false }
          >
        ).onChange
      : undefined;
 
  const multiOnChange =
    isMulti
      ? (
          props as Extract<
            DropdownProps,
            { isMulti: true }
          >
        ).onChange
      : undefined;
 
  /*
   * Normalize selected values.
   */
  const selectedValues: DropdownValue[] =
    isMulti
      ? Array.isArray(value)
        ? value
        : []
      : value &&
          !Array.isArray(value)
        ? [value]
        : [];
 
  const hasValue =
    selectedValues.length > 0;
 
  /**
   * Create normalized value.
   */
  const createDropdownValue = (
    option: DropdownOption
  ): DropdownValue => ({
    name: option.name,
    value:
      option.value ?? option.name,
  });
 
  /**
   * Check whether an option is selected.
   */
  const isOptionSelected = (
    option: DropdownOption
  ): boolean => {
    const optionValue =
      option.value ?? option.name;
 
    return selectedValues.some(
      (selectedValue) =>
        selectedValue.value ===
        optionValue
    );
  };
 
  /**
   * Build cache key.
   *
   * The cache is separated by:
   *
   * - search
   * - cacheUniques
   * - params
   *
   * Example:
   *
   * Country = IN
   * Search = ""
   *
   * has a different cache from:
   *
   * Country = US
   * Search = ""
   */
  const getCacheKey = useCallback(
    (searchValue: string) => {
      return JSON.stringify({
        search: searchValue,
        cacheUniques,
        params,
      });
    },
    [cacheUniques, params]
  );
 
  /**
   * Get all cached options for
   * the current search.
   */
  const getCachedOptions = useCallback(
    (
      searchValue: string
    ): DropdownOption[] => {
      const cacheKey =
        getCacheKey(searchValue);
 
      const cache =
        optionCache[cacheKey];
 
      if (!cache) {
        return [];
      }
 
      const pages =
        Object.keys(
          cache.pages
        ).map(Number);
 
      pages.sort(
        (a, b) => a - b
      );
 
      const merged: DropdownOption[] =
        [];
 
      const seen = new Set<string>();
 
      for (const pageNumber of pages) {
        const pageData =
          cache.pages[
            pageNumber
          ];
 
        if (!pageData) {
          continue;
        }
 
        for (const option of pageData.options) {
          const key = String(
            option.value ??
              option.name
          );
 
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(option);
          }
        }
      }
 
      return merged;
    },
    [getCacheKey, optionCache]
  );
 
  /**
   * Get the cached hasMore value
   * for a page.
   */
  const getCachedPage = useCallback(
    (
      searchValue: string,
      pageNumber: number
    ): CachedPage | undefined => {
      const cacheKey =
        getCacheKey(searchValue);
 
      return optionCache[
        cacheKey
      ]?.pages[pageNumber];
    },
    [getCacheKey, optionCache]
  );
 
  /**
   * Rebuild visible async options
   * from cache.
   */
  const rebuildFromCache = useCallback(
    (
      searchValue: string
    ) => {
      const cachedOptions =
        getCachedOptions(
          searchValue
        );
 
      setAsyncOptions(
        cachedOptions
      );
 
      const cacheKey =
        getCacheKey(searchValue);
 
      const cache =
        optionCache[cacheKey];
 
      if (!cache) {
        setPage(0);
        setHasMore(false);
        return;
      }
 
      const pages =
        Object.keys(
          cache.pages
        ).map(Number);
 
      if (pages.length === 0) {
        setPage(0);
        setHasMore(false);
        return;
      }
 
      pages.sort(
        (a, b) => b - a
      );
 
      const latestPage =
        pages[0];
 
      const latestPageData =
        cache.pages[
          latestPage
        ];
 
      setPage(latestPage);
 
      setHasMore(
        Boolean(
          latestPageData?.hasMore
        )
      );
    },
    [
      getCacheKey,
      getCachedOptions,
      optionCache,
    ]
  );
 
  /**
   * Load one page from API.
   */
  const fetchPage = useCallback(
    async (
      searchValue: string,
      pageNumber: number
    ) => {
      if (!loadOptions) {
        return;
      }
 
      const cacheKey =
        getCacheKey(searchValue);
 
      const pageCacheKey =
        `${cacheKey}|page:${pageNumber}`;
 
      /*
       * Don't request the same page
       * while it is already loading.
       */
      if (
        loadingPagesRef.current.has(
          pageCacheKey
        )
      ) {
        return;
      }
 
      /*
       * Don't request a page that
       * already exists in cache.
       */
      const existingPage =
        optionCache[cacheKey]
          ?.pages[pageNumber];
 
      if (existingPage) {
        rebuildFromCache(
          searchValue
        );
        return;
      }
 
      loadingPagesRef.current.add(
        pageCacheKey
      );
 
      const requestId =
        ++requestIdRef.current;
 
      try {
        setLoading(true);
 
        const result =
          await loadOptions({
            search: searchValue,
            page: pageNumber,
            params,
          });
 
        /*
         * Ignore stale requests.
         */
        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }
 
        setOptionCache(
          (previous) => {
            const currentCache =
              previous[
                cacheKey
              ];
 
            const currentPages =
              currentCache
                ?.pages ?? {};
 
            return {
              ...previous,
 
              [cacheKey]: {
                pages: {
                  ...currentPages,
 
                  [pageNumber]: {
                    options:
                      result.options,
                    hasMore:
                      Boolean(
                        result.hasMore
                      ),
                  },
                },
              },
            };
          }
        );
 
        /*
         * Update visible options
         * directly from the response.
         */
        setAsyncOptions(
          (previous) => {
            if (pageNumber === 0) {
              return [
                ...result.options,
              ];
            }
 
            const merged = [
              ...previous,
              ...result.options,
            ];
 
            const uniqueOptions: DropdownOption[] =
              [];
 
            const seen =
              new Set<string>();
 
            for (const option of merged) {
              const key =
                String(
                  option.value ??
                    option.name
                );
 
              if (!seen.has(key)) {
                seen.add(key);
                uniqueOptions.push(
                  option
                );
              }
            }
 
            return uniqueOptions;
          }
        );
 
        setPage(pageNumber);
 
        setHasMore(
          Boolean(result.hasMore)
        );
      } catch (requestError) {
        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }
 
        console.error(
          "Failed to load dropdown options:",
          requestError
        );
      } finally {
        loadingPagesRef.current.delete(
          pageCacheKey
        );
 
        if (
          requestId ===
          requestIdRef.current
        ) {
          setLoading(false);
        }
      }
    },
    [
      getCacheKey,
      loadOptions,
      optionCache,
      params,
      rebuildFromCache,
    ]
  );
 
  /**
   * Async search.
   *
   * First checks the cache.
   * API is only called when page 0
   * is not cached.
   *
   * The very first load when the
   * dropdown opens skips the debounce
   * so options aren't shown as empty
   * while waiting. Debounce only
   * applies once the user is typing
   * a search while it's open.
   */
  useEffect(() => {
    if (
      !isAsync ||
      !isOpen
    ) {
      wasOpenRef.current = isOpen;
      return;
    }

    const justOpened =
      !wasOpenRef.current;

    wasOpenRef.current = isOpen;

    if (debounceRef.current) {
      clearTimeout(
        debounceRef.current
      );
    }

    const runSearch = () => {
      const cachedPage =
        getCachedPage(
          search,
          0
        );

      if (cachedPage) {
        rebuildFromCache(search);
        return;
      }

      fetchPage(
        search,
        0
      );
    };

    if (justOpened) {
      runSearch();
    } else {
      debounceRef.current =
        setTimeout(
          runSearch,
          debounceDelay
        );
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(
          debounceRef.current
        );
      }
    };
  }, [
    search,
    isAsync,
    isOpen,
    debounceDelay,
    getCachedPage,
    rebuildFromCache,
    fetchPage,
  ]);
 
  /**
   * Cleanup debounce.
   */
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(
          debounceRef.current
        );
      }
    };
  }, []);
 
  /**
   * Reset entire cache when
   * cacheUniques changes.
   *
   * Compares against the previous key (not a "have we run
   * yet" flag) so this doesn't misfire under React Strict
   * Mode's dev-only double-invocation of mount effects,
   * which would otherwise wipe an initial default value.
   */
  useEffect(() => {
    const currentCacheUniquesKey =
      JSON.stringify(cacheUniques);

    const previousCacheUniquesKey =
      cacheInitializedRef.current;

    cacheInitializedRef.current =
      currentCacheUniquesKey;

    if (
      previousCacheUniquesKey ===
        false ||
      previousCacheUniquesKey ===
        currentCacheUniquesKey
    ) {
      return;
    }

    requestIdRef.current += 1;
 
    loadingPagesRef.current.clear();
 
    setOptionCache({});
    setAsyncOptions([]);
    setPage(0);
    setHasMore(false);
    setSearch("");
    setIsOpen(false);
    setLoading(false);
 
    requestAnimationFrame(() => {
      selectedTagsRef.current?.scrollTo(
        {
          top: 0,
          left: 0,
          behavior: "auto",
        }
      );
    });
 
    if (isMulti) {
      multiOnChange?.([]);
    } else {
      singleOnChange?.(null);
    }
  }, [JSON.stringify(cacheUniques)]);
 
  /**
   * Close dropdown.
   */
  const closeDropdown = () => {
    setIsOpen(false);
    setSearch("");
 
    requestAnimationFrame(() => {
      selectedTagsRef.current?.scrollTo(
        {
          top: 0,
          left: 0,
          behavior: "auto",
        }
      );
    });
  };
 
  /**
   * Outside click.
   */
  useEffect(() => {
    const handleOutsideClick = (
      event: globalThis.MouseEvent
    ) => {
      const target =
        event.target as Node;

      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(
          target
        ) &&
        !menuRef.current?.contains(
          target
        )
      ) {
        closeDropdown();
      }
    };
 
    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );
 
    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);
 
  /**
   * Position the portalled menu against the field.
   *
   * Opens below the field, or above it
   * when there is more room there.
   */
  const positionMenu = useCallback(() => {
    const menu = menuRef.current;
    const options = optionsRef.current;
    const anchor = fieldWrapperRef.current;

    if (!menu || !options || !anchor) {
      return;
    }

    const rect =
      anchor.getBoundingClientRect();

    const chromeHeight =
      menu.offsetHeight -
      options.clientHeight;

    const naturalHeight = Math.min(
      options.scrollHeight +
        chromeHeight,
      MENU_MAX_HEIGHT
    );

    const spaceBelow =
      window.innerHeight -
      rect.bottom -
      MENU_GAP -
      VIEWPORT_MARGIN;

    const spaceAbove =
      rect.top -
      MENU_GAP -
      VIEWPORT_MARGIN;

    const openAbove =
      naturalHeight > spaceBelow &&
      spaceAbove > spaceBelow;

    const space = Math.max(
      openAbove
        ? spaceAbove
        : spaceBelow,
      MENU_MIN_HEIGHT
    );

    menu.style.left = `${rect.left}px`;
    menu.style.width = `${rect.width}px`;
    menu.style.top = openAbove
      ? "auto"
      : `${rect.bottom + MENU_GAP}px`;
    menu.style.bottom = openAbove
      ? `${
          window.innerHeight -
          rect.top +
          MENU_GAP
        }px`
      : "auto";
    menu.style.setProperty(
      "--sila-dropdown-menu-max-height",
      `${Math.min(
        MENU_MAX_HEIGHT,
        space
      )}px`
    );
  }, []);

  /**
   * Re-measure after every render while open:
   * options load, and multi-select tags
   * change the field's height.
   */
  useLayoutEffect(() => {
    if (isOpen) {
      positionMenu();
    }
  });

  /**
   * Keep the menu attached to the field
   * while the page or any ancestor scrolls.
   */
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const reposition = (
      event: Event
    ) => {
      // Scrolling the options list itself must not move the menu.
      if (
        event.target instanceof Node &&
        menuRef.current?.contains(
          event.target
        )
      ) {
        return;
      }

      positionMenu();
    };

    window.addEventListener(
      "resize",
      reposition
    );

    window.addEventListener(
      "scroll",
      reposition,
      true
    );

    return () => {
      window.removeEventListener(
        "resize",
        reposition
      );

      window.removeEventListener(
        "scroll",
        reposition,
        true
      );
    };
  }, [isOpen, positionMenu]);

  /**
   * Open dropdown.
   */
  const openDropdown = () => {
    if (isDisable) {
      return;
    }
 
    setIsOpen(true);
 
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };
 
  /**
   * Toggle dropdown.
   */
  const handleToggle = () => {
    if (isDisable) {
      return;
    }
 
    if (isOpen) {
      closeDropdown();
      return;
    }
 
    openDropdown();
  };
 
  /**
   * Input click.
   */
  const handleInputClick = (
    event: ReactMouseEvent<HTMLInputElement>
  ) => {
    event.stopPropagation();
 
    if (!isOpen) {
      openDropdown();
    }
  };
 
  /**
   * Search change.
   */
  const handleSearchChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    setSearch(
      event.target.value
    );
 
    if (!isOpen) {
      setIsOpen(true);
    }
  };
 
  /**
   * Handle option selection.
   */
  const handleSelect = (
    option: DropdownOption
  ) => {
    const selectedValue =
      createDropdownValue(option);
 
    /*
     * Multi select.
     */
    if (isMulti) {
      const alreadySelected =
        selectedValues.some(
          (item) =>
            item.value ===
            selectedValue.value
        );
 
      let nextValues: DropdownValue[];
 
      if (alreadySelected) {
        nextValues =
          selectedValues.filter(
            (item) =>
              item.value !==
              selectedValue.value
          );
      } else {
        nextValues = [
          ...selectedValues,
          selectedValue,
        ];
      }
 
      multiOnChange?.(
        nextValues
      );
 
      setSearch("");
 
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
 
      return;
    }
 
    /*
     * Single select.
     */
    singleOnChange?.(
      selectedValue
    );
 
    closeDropdown();
  };
 
  /**
   * Remove one selected tag.
   */
  const handleRemoveSelected = (
    event: ReactMouseEvent<HTMLButtonElement>,
    selectedValue: DropdownValue
  ) => {
    event.stopPropagation();
 
    if (
      isDisable ||
      !isMulti
    ) {
      return;
    }
 
    const nextValues =
      selectedValues.filter(
        (item) =>
          item.value !==
          selectedValue.value
      );
 
    multiOnChange?.(
      nextValues
    );
 
    setIsOpen(true);
    setSearch("");
 
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };
 
  /**
   * Clear all selected values.
   */
  const handleClear = (
    event: ReactMouseEvent<HTMLButtonElement>
  ) => {
    event.stopPropagation();
 
    if (isDisable) {
      return;
    }
 
    if (isMulti) {
      multiOnChange?.([]);
    } else {
      singleOnChange?.(null);
    }
 
    setSearch("");
 
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };
 
  /**
   * Automatically load the next page.
   *
   * Triggered when the user scrolls
   * close to the bottom.
   */
  const handleOptionsScroll = (
    event: React.UIEvent<HTMLDivElement>
  ) => {
    if (
      !isAsync ||
      loading ||
      !hasMore
    ) {
      return;
    }
 
    const element =
      event.currentTarget;
 
    const distanceFromBottom =
      element.scrollHeight -
      element.scrollTop -
      element.clientHeight;
 
    /*
     * Start loading when the user
     * is within 60px of the bottom.
     */
    if (
      distanceFromBottom <= 60
    ) {
      const nextPage =
        page + 1;
 
      const cachedPage =
        getCachedPage(
          search,
          nextPage
        );
 
      if (cachedPage) {
        rebuildFromCache(
          search
        );
        return;
      }
 
      fetchPage(
        search,
        nextPage
      );
    }
  };
 
  /**
   * Normal dropdown filtering.
   */
  const filteredOptions = isAsync
    ? asyncOptions
    : options.filter((option) =>
        option.name
          .toLowerCase()
          .includes(
            search.toLowerCase()
          )
      );
 
  /**
   * Remove selected options from
   * multi-select dropdown list.
   */
  const visibleOptions =
    filteredOptions.filter(
      (option) => {
        if (!isMulti) {
          return true;
        }
 
        return !isOptionSelected(
          option
        );
      }
    );
 
  /**
   * Single display value.
   */
  const displayValue =
    selectedValues
      .map(
        (selectedValue) =>
          selectedValue.name
      )
      .join(", ");
 
  /**
   * Multi mode uses the input only
   * for searching.
   */
  const inputValue = isMulti
    ? search
    : isOpen
      ? search
      : displayValue;
 
  const containerClasses = [
    "sila-dropdown",
 
    hasError
      ? "sila-dropdown--error"
      : "",
 
    isDisable
      ? "sila-dropdown--disabled"
      : "",
 
    isOpen
      ? "sila-dropdown--open"
      : "",
 
    isMulti
      ? "sila-dropdown--multi"
      : "",
 
    className,
  ]
    .filter(Boolean)
    .join(" ");
 
  return (
    <div
      ref={dropdownRef}
      className={containerClasses}
      style={style}
    >
     {label && (
          <label className={`sila-dropdown__label${hideLabel ? " sila-visually-hidden" : ""}`}>
            {label}
 
            {isRequired && (
              <span className="sila-dropdown__required">
                *
              </span>
            )}
          </label>
     )}

      <div
        ref={fieldWrapperRef}
        className="sila-dropdown__field-wrapper"
      >
 
        <div
          className="sila-dropdown__field"
          onClick={handleToggle}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-disabled={isDisable}
        >
 
          {isMulti ? (
            <div className="sila-dropdown__selected-area">
 
              <div
                ref={selectedTagsRef}
                className="sila-dropdown__selected-tags"
              >
                {selectedValues.map(
                  (selectedValue) => (
                    <span
                      key={
                        selectedValue.value
                      }
                      className="sila-dropdown__tag"
                    >
                      <span className="sila-dropdown__tag-text">
                        {
                          selectedValue.name
                        }
                      </span>
 
                      <button
                        type="button"
                        className="sila-dropdown__tag-remove"
                        disabled={
                          isDisable
                        }
                        onClick={(
                          event
                        ) =>
                          handleRemoveSelected(
                            event,
                            selectedValue
                          )
                        }
                        aria-label={`Remove ${selectedValue.name}`}
                      >
                        <FaTimes
                          aria-hidden="true"
                        />
                      </button>
                    </span>
                  )
                )}
 
                {isOpen && (
                  <input
                    ref={inputRef}
                    type="text"
                    className="sila-dropdown__input sila-dropdown__input--multi"
                    value={inputValue}
                    placeholder={
                      hasValue
                        ? ""
                        : "Search..."
                    }
                    disabled={
                      isDisable
                    }
                    onClick={
                      handleInputClick
                    }
                    onChange={
                      handleSearchChange
                    }
                    aria-autocomplete="list"
                    autoComplete="off-search"
                  />
                )}
              </div>
 
              {isClearable &&
              hasValue ? (
                <button
                  type="button"
                  className="sila-dropdown__clear"
                  onClick={
                    handleClear
                  }
                  disabled={
                    isDisable
                  }
                  aria-label="Clear all selections"
                >
                  <FaTimes
                    aria-hidden="true"
                  />
                </button>
              ) : (
                <FaChevronDown
                  className="sila-dropdown__arrow"
                  aria-hidden="true"
                />
              )}
            </div>
          ) : (
            <>
              <input
                ref={inputRef}
                type="text"
                className="sila-dropdown__input"
                value={inputValue}
                placeholder={
                  isOpen
                    ? "Search..."
                    : placeholder
                }
                disabled={isDisable}
                onClick={
                  handleInputClick
                }
                onChange={
                  handleSearchChange
                }
                aria-autocomplete="list"
                // Chrome ignores "off" for address-like fields (e.g. Country) and shows saved addresses;
                // an unrecognised token keeps its autofill popup away from this search box.
                autoComplete="off-search"
              />
 
              {isClearable &&
              hasValue ? (
                <button
                  type="button"
                  className="sila-dropdown__clear"
                  onClick={handleClear}
                  disabled={
                    isDisable
                  }
                  aria-label="Clear selection"
                >
                  <FaTimes
                    aria-hidden="true"
                  />
                </button>
              ) : (
                <FaChevronDown
                  className="sila-dropdown__arrow"
                  aria-hidden="true"
                />
              )}
            </>
          )}
        </div>
      </div>
 
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            className="sila-dropdown__menu"
          >
            <div
              ref={optionsRef}
              className="sila-dropdown__options"
              role="listbox"
              aria-multiselectable={
                isMulti
              }
              onScroll={
                handleOptionsScroll
              }
            >
              {loading &&
              visibleOptions.length ===
                0 ? (
                <div className="sila-dropdown__loading">
                  <FaSpinner className="sila-dropdown__spinner" />
 
                  <span>
                    Loading...
                  </span>
                </div>
              ) : visibleOptions.length ===
                0 && !loading ? (
                <div className="sila-dropdown__empty">
                  No options found
                </div>
              ) : (
                <>
                  {visibleOptions.map(
                    (option) => (
                      <button
                        key={String(
                          option.value ??
                            option.name
                        )}
                        type="button"
                        className={`sila-dropdown__option${
                          isOptionSelected(option)
                            ? " selected"
                            : ""
                        }`}
                        onClick={() =>
                          handleSelect(
                            option
                          )
                        }
                        role="option"
                        aria-selected={
                          isOptionSelected(
                            option
                          )
                        }
                      >
                        {option.name}
                      </button>
                    )
                  )}
 
                  {isAsync &&
                    loading && (
                      <div className="sila-dropdown__loading sila-dropdown__loading--bottom">
                        <FaSpinner className="sila-dropdown__spinner" />
 
                        <span>
                          Loading...
                        </span>
                      </div>
                    )}
                </>
              )}
            </div>
          </div>,
          document.body
        )}
 
      {error ? (
        <div
          className="sila-dropdown__message sila-dropdown__message--error"
          role="alert"
        >
          <FaExclamationCircle />
 
          <span title={error}>
            {error}
          </span>
        </div>
      ) : infoText ? (
        <div className="sila-dropdown__message sila-dropdown__message--info">
          <FaInfoCircle />
 
          <span title={infoText}>
            {infoText}
          </span>
        </div>
      ) : null}
    </div>
  );
};
 
export default Dropdown;