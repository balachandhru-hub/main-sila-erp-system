import React from "react";
import { ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon, FileIcon, Loader } from "@vosox/shared-ui";
import type { BuyerCatalogResponse } from "../../api/Buyerapi";

interface ProductDetailViewProps {
  product: BuyerCatalogResponse;
  images: string[];
  selectedImageIndex: number;
  loading: boolean;
  loadingImages: boolean;
  error: string | null;
  onBack: () => void;
  onRetry: () => void;
  onSelectImage: (index: number) => void;
  onPrevImage: () => void;
  onNextImage: () => void;
  onPunchOutPreview: (url: string) => void;
  /** When given, the product shows "Add to cart". */
  onAddToCart?: (product: BuyerCatalogResponse) => void;
  /** The product is already in the cart. */
  inCart?: boolean;
}

/** Full-page detail view for a single catalog product. */
const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  product,
  images,
  selectedImageIndex,
  loading,
  loadingImages,
  error,
  onBack,
  onRetry,
  onSelectImage,
  onPrevImage,
  onNextImage,
  onPunchOutPreview,
  onAddToCart,
  inCart = false,
}) => (
  <div className="pud-product-page">
    <div className="pud-catalog-fullview-header">
      <div>
        <button type="button" className="pud-btn pud-btn-outline" onClick={onBack}>
          <ChevronLeftIcon /> Back to Products
        </button>
      </div>
    </div>

    <div className="pud-product-detail">
      <div className="pud-product-detail-gallery">
        <div className="pud-product-detail-media">
          {loading || loadingImages ? (
            <Loader size={28} />
          ) : error ? (
            <div className="pud-product-detail-error" role="alert">
              <div className="pud-product-detail-error-text">{error}</div>
              <button type="button" className="pud-btn pud-btn-outline" onClick={onRetry}>
                Retry Loading
              </button>
            </div>
          ) : images.length > 0 ? (
            <img
              src={images[selectedImageIndex]}
              alt={product.catalogName}
              className="pud-product-detail-image"
            />
          ) : (
            <div className="pud-product-detail-placeholder"><FileIcon /></div>
          )}

          {images.length > 1 && (
            <>
              <button
                type="button"
                className="pud-product-detail-nav pud-product-detail-nav-prev"
                onClick={onPrevImage}
                title="Previous image"
                aria-label="Previous image"
              >
                <ChevronLeftIcon />
              </button>
              <button
                type="button"
                className="pud-product-detail-nav pud-product-detail-nav-next"
                onClick={onNextImage}
                title="Next image"
                aria-label="Next image"
              >
                <ChevronRightIcon />
              </button>
            </>
          )}
        </div>

        {images.length > 1 && (
          <div className="pud-product-detail-thumbs">
            {images.map((src, idx) => (
              <button
                type="button"
                key={idx}
                className={`pud-product-detail-thumb${idx === selectedImageIndex ? " pud-product-detail-thumb-active" : ""}`}
                onClick={() => onSelectImage(idx)}
                aria-label={`Show image ${idx + 1}`}
                aria-pressed={idx === selectedImageIndex}
              >
                <img src={src} alt={`thumb-${idx}`} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pud-product-detail-info">
        <h1 className="pud-title">{product.catalogName}</h1>
        <p className="pud-product-item-supplier">by {product.supplierName}</p>

        {product.catalogType && (
          <span className="pud-catalog-card-tag pud-product-detail-tag">
            {product.catalogType}
          </span>
        )}

        {product.description && (
          <p className="pud-product-detail-desc">{product.description}</p>
        )}

        <div className="pud-catalog-card-meta">
          {product.price > 0 && (
            <span className="pud-catalog-card-price">
              {product.currency} {product.price.toFixed(2)}
            </span>
          )}
          {product.unitOfMeasure && (
            <span className="pud-catalog-card-uom">per {product.unitOfMeasure}</span>
          )}
        </div>

        {(product.sku || product.availableStock != null || (product.discountPercent ?? 0) > 0) && (
          <div className="pud-catalog-card-meta">
            {product.sku && <span className="pud-catalog-card-uom">SKU: {product.sku}</span>}
            {product.availableStock != null && (
              <span className="pud-catalog-card-uom">Supplier stock: {product.availableStock}</span>
            )}
            {(product.discountPercent ?? 0) > 0 && (
              <span className="pud-catalog-card-uom">Discount: {product.discountPercent}%</span>
            )}
          </div>
        )}

        {onAddToCart && !loading && !error && (
          <div className="pud-product-item-action">
            <button
              type="button"
              className="pud-btn pud-btn-message"
              disabled={inCart}
              onClick={() => onAddToCart(product)}
            >
              {inCart ? "Added to cart" : "Add to cart"}
            </button>
          </div>
        )}

        {/* Show classification even if titles are null */}
        {(product.segment || product.family || product.class || product.commodity) && (
          <div className="pud-catalog-card-classification">
            <div className="pud-catalog-form-section-title">Classification</div>
            {product.segment && (
              <div className="pud-catalog-classification-row">
                <span className="pud-catalog-classification-label">Segment:</span>
                <span className="pud-catalog-classification-value">
                  {product.segment}
                  {product.segmentTitle && ` - ${product.segmentTitle}`}
                </span>
              </div>
            )}
            {product.family && (
              <div className="pud-catalog-classification-row">
                <span className="pud-catalog-classification-label">Family:</span>
                <span className="pud-catalog-classification-value">
                  {product.family}
                  {product.familyTitle && ` - ${product.familyTitle}`}
                </span>
              </div>
            )}
            {product.class && (
              <div className="pud-catalog-classification-row">
                <span className="pud-catalog-classification-label">Class:</span>
                <span className="pud-catalog-classification-value">
                  {product.class}
                  {product.classTitle && ` - ${product.classTitle}`}
                </span>
              </div>
            )}
            {product.commodity && (
              <div className="pud-catalog-classification-row">
                <span className="pud-catalog-classification-label">Commodity:</span>
                <span className="pud-catalog-classification-value">
                  {product.commodity}
                  {product.commodityTitle && ` - ${product.commodityTitle}`}
                </span>
              </div>
            )}
          </div>
        )}

        {product.isPunchOut && product.punchOutUrl && (
          <div className="pud-product-item-action">
            <button
              type="button"
              className="pud-product-item-link"
              onClick={() => onPunchOutPreview(product.punchOutUrl)}
            >
              <ExternalLinkIcon /> View Catalog
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
);

export default ProductDetailView;
