import React from "react";
import "./Product.css";
import "../../../remote-supplier/src/components/Catalog.css";
import ProductFilters from "./product/ProductFilters";
import ProductToolbar from "./product/ProductToolbar";
import { useFilterDrawer } from "./product/useFilterDrawer";
import ProductResults from "./product/ProductResults";
import ProductDetailView from "./product/ProductDetailView";
import PunchOutView from "./product/PunchOutView";
import { useProductCatalog } from "../hooks/useProductCatalog";
import { useCartStore } from "../store/useCartStore";
import type { BuyerCatalogResponse } from "../api/Buyerapi";
import { toastService } from "@vosox/shared-ui";

const FILTER_DRAWER_ID = "pud-catalog-filters";

interface ProductProps {
  /** Shows "Add to cart" on products, for roles that manage wishlists. */
  canAddToCart?: boolean;
  /** Opens the cart, where the products are added to a wishlist. */
  onOpenCart?: () => void;
}

/**
 * Buyer product catalog: products fill the page; search, sort and paging sit above the grid and the filters
 * live in a drawer that opens, closes and moves to either side (remembered in this browser).
 */
const Product: React.FC<ProductProps> = ({ canAddToCart = false, onOpenCart }) => {
  const catalog = useProductCatalog();
  const drawer = useFilterDrawer();
  const cartProducts = useCartStore((state) => state.products);
  const addCartProduct = useCartStore((state) => state.addProduct);
  const cartCatalogIds = cartProducts.map((item) => item.catalogId);

  const handleAddToCart = (product: BuyerCatalogResponse) => {
    addCartProduct(product);
    toastService.success(`${product.catalogName} added to cart.`);
  };

  if (catalog.showPunchOutFullPage && catalog.selectedProduct) {
    return (
      <PunchOutView
        catalogName={catalog.selectedProduct.catalogName}
        previewUrl={catalog.punchOutPreviewUrl}
        iframeBlocked={catalog.punchOutIframeBlocked}
        onIframeError={() => catalog.setPunchOutIframeBlocked(true)}
        onBack={() => catalog.setShowPunchOutFullPage(false)}
      />
    );
  }

  if (catalog.selectedProduct) {
    return (
      <ProductDetailView
        product={catalog.selectedProduct}
        images={catalog.selectedProductImages}
        selectedImageIndex={catalog.selectedImageIndex}
        loading={catalog.loadingProductDetail}
        loadingImages={catalog.loadingSelectedImages}
        error={catalog.productDetailError}
        onBack={catalog.closeProductDetail}
        onRetry={() => catalog.selectedProduct && catalog.openProductDetail(catalog.selectedProduct.catalogId)}
        onSelectImage={catalog.setSelectedImageIndex}
        onPrevImage={catalog.goToPrevProductImage}
        onNextImage={catalog.goToNextProductImage}
        onPunchOutPreview={catalog.handlePunchOutPreview}
        onAddToCart={canAddToCart ? handleAddToCart : undefined}
        inCart={cartCatalogIds.includes(catalog.selectedProduct.catalogId)}
      />
    );
  }

  return (
    <div className="pud-product-page">
      <div className="pud-product-header pud-product-header-row">
        <div>
          <h1 className="pud-title">Product Catalog</h1>
          <p className="pud-subtitle">Search, sort and filter products from your suppliers</p>
        </div>
        {canAddToCart && onOpenCart && (
          <button type="button" className="pud-btn pud-btn-message" onClick={onOpenCart}>
            Cart ({cartProducts.length})
          </button>
        )}
      </div>

      <ProductToolbar
        search={catalog.filters.search}
        sort={catalog.sort}
        pageSize={catalog.pageSize}
        filtersOpen={drawer.open}
        drawerId={FILTER_DRAWER_ID}
        activeFilterCount={catalog.activeFilterCount}
        loading={catalog.loadingResults}
        onSearchChange={catalog.handleSearchChange}
        onSearchSubmit={catalog.handleSearchSubmit}
        onSortChange={catalog.changeSort}
        onPageSizeChange={catalog.changePageSize}
        onToggleFilters={drawer.toggle}
      />

      <div className={`pud-catalog-layout pud-catalog-layout--filters-${drawer.side}`}>
        {drawer.open && (
          <ProductFilters
            id={FILTER_DRAWER_ID}
            side={drawer.side}
            filters={catalog.filters}
            selectedSegment={catalog.selectedSegment}
            selectedFamily={catalog.selectedFamily}
            selectedClass={catalog.selectedClass}
            selectedCommodity={catalog.selectedCommodity}
            loadSegmentOptions={catalog.loadSegmentOptions}
            loadFamilyOptions={catalog.loadFamilyOptions}
            loadClassOptions={catalog.loadClassOptions}
            loadCommodityOptions={catalog.loadCommodityOptions}
            onSegmentChange={catalog.handleSegmentChange}
            onFamilyChange={catalog.handleFamilyChange}
            onClassChange={catalog.handleClassChange}
            onCommodityChange={catalog.handleCommodityChange}
            onSupplierChange={catalog.handleSupplierChange}
            onApply={catalog.handleSearchSubmit}
            onClear={catalog.clearFilters}
            onMove={drawer.moveToOtherSide}
            onClose={drawer.close}
            loadingResults={catalog.loadingResults}
          />
        )}

        <ProductResults
          error={catalog.error}
          loading={catalog.loadingResults}
          hasSearched={catalog.hasSearched}
          catalogResults={catalog.catalogResults}
          productAssetImages={catalog.productAssetImages}
          onOpenDetail={catalog.openProductDetail}
          onAddToCart={canAddToCart ? handleAddToCart : undefined}
          cartCatalogIds={cartCatalogIds}
          pageSize={catalog.pageSize}
          page={catalog.page}
          hasNextPage={catalog.hasNextPage}
          onPrevPage={() => catalog.goToPage(catalog.page - 1)}
          onNextPage={() => catalog.goToPage(catalog.page + 1)}
        />
      </div>
    </div>
  );
};

export default Product;
