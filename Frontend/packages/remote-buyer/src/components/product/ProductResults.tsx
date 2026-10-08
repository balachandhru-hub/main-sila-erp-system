import React from "react";
import { Button, EmptyState, FileIcon, Loader, Pagination, SearchIcon } from "@vosox/shared-ui";
import type { BuyerCatalogResponse } from "../../api/Buyerapi";

interface ProductResultsProps {
  error: string | null;
  loading: boolean;
  hasSearched: boolean;
  /** The products of the current server page. */
  catalogResults: BuyerCatalogResponse[];
  productAssetImages: Record<string, string>;
  onOpenDetail: (catalogId: string) => void;
  /** When given, each product shows "Add to cart". */
  onAddToCart?: (product: BuyerCatalogResponse) => void;
  /** Catalog ids already in the cart. */
  cartCatalogIds?: string[];
  pageSize: number;
  /** 0-based page number. */
  page: number;
  hasNextPage: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
}

/** One page of products: loading/empty/error states, the product grid and the server-side pager. */
const ProductResults: React.FC<ProductResultsProps> = ({
  error,
  loading,
  hasSearched,
  catalogResults,
  productAssetImages,
  onOpenDetail,
  onAddToCart,
  cartCatalogIds = [],
  pageSize,
  page,
  hasNextPage,
  onPrevPage,
  onNextPage,
}) => (
  <div className="pud-product-results" aria-busy={loading}>
    {error && (
      <div className="pud-product-error" role="alert">
        <p>{error}</p>
      </div>
    )}

    {loading ? (
      <div className="pud-product-loading">
        <Loader size={28} message="Loading products..." />
      </div>
    ) : hasSearched && catalogResults.length === 0 && page === 0 ? (
      <EmptyState
        className="pud-product-empty"
        icon={<FileIcon />}
        title="No products found"
        description="Try adjusting your filters or search terms"
      />
    ) : hasSearched ? (
      <>
        <div className="pud-product-results-header">
          <h2 className="pud-product-results-title">
            {catalogResults.length === 0
              ? "No more products"
              : `Products ${page * pageSize + 1}–${page * pageSize + catalogResults.length}`}
          </h2>
        </div>

        <div className="pud-catalog-grid">
          {catalogResults.map((item) => {
            const firstAssetId = item.asset && item.asset[0]?.id;
            const imageSrc = firstAssetId ? productAssetImages[firstAssetId] : undefined;
            return (
              <div
                className="pud-catalog-card"
                key={item.catalogId}
                onClick={() => onOpenDetail(item.catalogId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenDetail(item.catalogId);
                  }
                }}
                role="button"
                tabIndex={0}
                title={`View ${item.catalogName}`}
              >
                <div className="pud-catalog-card-media">
                  {imageSrc ? (
                    <img src={imageSrc} alt={item.catalogName} />
                  ) : (
                    <div className="pud-catalog-card-media-placeholder"><FileIcon /></div>
                  )}
                  {item.isPunchOut && (
                    <span className="pud-catalog-card-source pud-catalog-card-source-created">
                      PunchOut
                    </span>
                  )}
                </div>
                <div className="pud-catalog-card-body">
                  <div className="pud-catalog-card-name" title={item.catalogName}>{item.catalogName}</div>
                  <p className="pud-product-item-supplier">by {item.supplierName}</p>
                  {item.description && (
                    <div className="pud-catalog-card-desc">{item.description}</div>
                  )}
                  <div className="pud-catalog-card-meta">
                    {item.price > 0 && (
                      <span className="pud-catalog-card-price">
                        {item.currency} {item.price.toFixed(2)}
                      </span>
                    )}
                    {item.unitOfMeasure && (
                      <span className="pud-catalog-card-uom">{item.unitOfMeasure}</span>
                    )}
                  </div>
                  {(item.sku || item.availableStock != null || (item.discountPercent ?? 0) > 0) && (
                    <div className="pud-catalog-card-meta">
                      {item.sku && <span className="pud-catalog-card-uom">SKU: {item.sku}</span>}
                      {item.availableStock != null && (
                        <span className="pud-catalog-card-uom">Supplier stock: {item.availableStock}</span>
                      )}
                      {(item.discountPercent ?? 0) > 0 && (
                        <span className="pud-catalog-card-uom">Discount: {item.discountPercent}%</span>
                      )}
                    </div>
                  )}
                  {onAddToCart && (
                    <div className="pud-product-item-action">
                      <Button
                        type="button"
                        variant="outline"
                        fullWidth
                        disabled={cartCatalogIds.includes(item.catalogId)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToCart(item);
                        }}
                        // The card itself opens the product on Enter/Space; keep those keys for this button.
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {cartCatalogIds.includes(item.catalogId) ? "Added to cart" : "Add to cart"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {(page > 0 || hasNextPage) && (
          <Pagination
            className="pud-catalog-pager"
            page={page + 1}
            hasNext={hasNextPage}
            onPrevious={onPrevPage}
            onNext={onNextPage}
            disabled={loading}
          />
        )}
      </>
    ) : (
      !hasSearched && (
        <EmptyState
          className="pud-product-empty"
          icon={<SearchIcon />}
          title="Start searching"
          description="Select filters or enter a search term to find products"
        />
      )
    )}
  </div>
);

export default ProductResults;
