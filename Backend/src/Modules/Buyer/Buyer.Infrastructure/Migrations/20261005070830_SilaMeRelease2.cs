using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Buyer.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SilaMeRelease2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "recipe_approval_user_mapping",
                schema: "buyersystem");

            migrationBuilder.DropIndex(
                name: "ix_stock_adjustment_buyer_id",
                schema: "buyersystem",
                table: "stock_adjustment");

            migrationBuilder.DropIndex(
                name: "ix_pos_sales_batch_buyer_id",
                schema: "buyersystem",
                table: "pos_sales_batch");

            migrationBuilder.DropIndex(
                name: "ix_inventory_transaction_buyer_id",
                schema: "buyersystem",
                table: "inventory_transaction");

            migrationBuilder.DropIndex(
                name: "ix_goods_receipt_buyer_id",
                schema: "buyersystem",
                table: "goods_receipt");

            migrationBuilder.DropIndex(
                name: "ix_goods_issue_buyer_id",
                schema: "buyersystem",
                table: "goods_issue");

            migrationBuilder.AlterColumn<string>(
                name: "enquiry_number",
                schema: "buyersystem",
                table: "stock_shortage_enquiry",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<bool>(
                name: "recount_requested",
                schema: "buyersystem",
                table: "stock_count_item",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "review_comment",
                schema: "buyersystem",
                table: "stock_count_item",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "review_status",
                schema: "buyersystem",
                table: "stock_count_item",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "count_number",
                schema: "buyersystem",
                table: "stock_count",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<DateTime>(
                name: "business_date",
                schema: "buyersystem",
                table: "stock_count",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "adjustment_number",
                schema: "buyersystem",
                table: "stock_adjustment",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<int>(
                name: "version",
                schema: "buyersystem",
                table: "recipe_outlet_price",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "version",
                schema: "buyersystem",
                table: "recipe_ingredient",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "active_version",
                schema: "buyersystem",
                table: "recipe",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "category_id",
                schema: "buyersystem",
                table: "recipe",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "draft_name",
                schema: "buyersystem",
                table: "recipe",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "draft_pos_code",
                schema: "buyersystem",
                table: "recipe",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "draft_selling_uom",
                schema: "buyersystem",
                table: "recipe",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "draft_serving_qty",
                schema: "buyersystem",
                table: "recipe",
                type: "decimal(18,4)",
                precision: 18,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "draft_serving_uom",
                schema: "buyersystem",
                table: "recipe",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "draft_total_cost",
                schema: "buyersystem",
                table: "recipe",
                type: "decimal(18,4)",
                precision: 18,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "family_id",
                schema: "buyersystem",
                table: "recipe",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "last_sale_date",
                schema: "buyersystem",
                table: "recipe",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "pos_item",
                schema: "buyersystem",
                table: "recipe",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "goods_receipt_expected",
                schema: "buyersystem",
                table: "purchase_order_item",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "delivery_date",
                schema: "buyersystem",
                table: "purchase_order",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "currency",
                schema: "buyersystem",
                table: "pos_sales_transaction",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "recipe_version",
                schema: "buyersystem",
                table: "pos_sales_transaction",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "uom",
                schema: "buyersystem",
                table: "pos_sales_transaction",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "batch_number",
                schema: "buyersystem",
                table: "pos_sales_batch",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<DateTime>(
                name: "business_date_from",
                schema: "buyersystem",
                table: "pos_sales_batch",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "business_date_to",
                schema: "buyersystem",
                table: "pos_sales_batch",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "pos_source_id",
                schema: "buyersystem",
                table: "pos_sales_batch",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "status",
                schema: "buyersystem",
                table: "pos_sales_batch",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "scope_code",
                schema: "buyersystem",
                table: "master_approval_flow",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "scope_id",
                schema: "buyersystem",
                table: "master_approval_flow",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "scope_kind",
                schema: "buyersystem",
                table: "master_approval_flow",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "batch_managed",
                schema: "buyersystem",
                table: "item_buyer_master",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "company_code",
                schema: "buyersystem",
                table: "item_buyer_master",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "expiry_managed",
                schema: "buyersystem",
                table: "item_buyer_master",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "inventory_type",
                schema: "buyersystem",
                table: "item_buyer_master",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "moving_average_price",
                schema: "buyersystem",
                table: "item_buyer_master",
                type: "decimal(18,4)",
                precision: 18,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "serial_managed",
                schema: "buyersystem",
                table: "item_buyer_master",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "shelf_life_days",
                schema: "buyersystem",
                table: "item_buyer_master",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "source",
                schema: "buyersystem",
                table: "item_buyer_master",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "standard_price",
                schema: "buyersystem",
                table: "item_buyer_master",
                type: "decimal(18,4)",
                precision: 18,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "match_status",
                schema: "buyersystem",
                table: "invoice_item",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "supplier_material_code",
                schema: "buyersystem",
                table: "invoice_item",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "tax_rate",
                schema: "buyersystem",
                table: "invoice_item",
                type: "decimal(9,4)",
                precision: 9,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "uom",
                schema: "buyersystem",
                table: "invoice_item",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "status",
                schema: "buyersystem",
                table: "invoice",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<string>(
                name: "content_hash",
                schema: "buyersystem",
                table: "invoice",
                type: "nvarchar(450)",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "erp_posting_id",
                schema: "buyersystem",
                table: "invoice",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "invoice_type",
                schema: "buyersystem",
                table: "invoice",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "net_amount",
                schema: "buyersystem",
                table: "invoice",
                type: "decimal(18,4)",
                precision: 18,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "sila_supplier_id",
                schema: "buyersystem",
                table: "invoice",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "supplier_tax_number",
                schema: "buyersystem",
                table: "invoice",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "tax_amount",
                schema: "buyersystem",
                table: "invoice",
                type: "decimal(18,4)",
                precision: 18,
                scale: 4,
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "transaction_number",
                schema: "buyersystem",
                table: "inventory_transaction",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<decimal>(
                name: "maximum_stock",
                schema: "buyersystem",
                table: "inventory_location_material",
                type: "decimal(18,4)",
                precision: 18,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "safety_stock",
                schema: "buyersystem",
                table: "inventory_location_material",
                type: "decimal(18,4)",
                precision: 18,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "stocking_type",
                schema: "buyersystem",
                table: "inventory_location_material",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "consumption_enabled",
                schema: "buyersystem",
                table: "inventory_location",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "cost_center",
                schema: "buyersystem",
                table: "inventory_location",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "description",
                schema: "buyersystem",
                table: "inventory_location",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "gl_account",
                schema: "buyersystem",
                table: "inventory_location",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "inventory_enabled",
                schema: "buyersystem",
                table: "inventory_location",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "parent_location_id",
                schema: "buyersystem",
                table: "inventory_location",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "profit_center",
                schema: "buyersystem",
                table: "inventory_location",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "company_code",
                schema: "buyersystem",
                table: "inventory_erp_posting",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "erp_http_status",
                schema: "buyersystem",
                table: "inventory_erp_posting",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "erp_request_payload",
                schema: "buyersystem",
                table: "inventory_erp_posting",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "erp_response_payload",
                schema: "buyersystem",
                table: "inventory_erp_posting",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "integration_system",
                schema: "buyersystem",
                table: "inventory_erp_posting",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "row_version",
                schema: "buyersystem",
                table: "inventory_balance",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AlterColumn<string>(
                name: "alert_type",
                schema: "buyersystem",
                table: "inventory_alert",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "ito_number",
                schema: "buyersystem",
                table: "internal_transfer_order",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<bool>(
                name: "already_collected",
                schema: "buyersystem",
                table: "internal_transfer_order",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "dispute_reason",
                schema: "buyersystem",
                table: "internal_transfer_order",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "batch_number",
                schema: "buyersystem",
                table: "goods_receipt_item",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "expiry_date",
                schema: "buyersystem",
                table: "goods_receipt_item",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "invoice_qty",
                schema: "buyersystem",
                table: "goods_receipt_item",
                type: "decimal(18,4)",
                precision: 18,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "open_qty_before",
                schema: "buyersystem",
                table: "goods_receipt_item",
                type: "decimal(18,4)",
                precision: 18,
                scale: 4,
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "grn_number",
                schema: "buyersystem",
                table: "goods_receipt",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "issue_number",
                schema: "buyersystem",
                table: "goods_issue",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.CreateTable(
                name: "company_code_master",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    code = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    country = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    currency = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_company_code_master", x => x.id);
                    table.ForeignKey(
                        name: "fk_company_code_master_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "internal_purchase_request",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    request_number = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    material_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    quantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    uom = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    requested_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    weekly_bucket_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    source = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_internal_purchase_request", x => x.id);
                    table.ForeignKey(
                        name: "fk_internal_purchase_request_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "invoice_extraction",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    invoice_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    attempt = table.Column<int>(type: "int", nullable: false),
                    trigger = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    method = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    confidence = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    message = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    fields_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    provider = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    duration_ms = table.Column<int>(type: "int", nullable: true),
                    content_hash = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_invoice_extraction", x => x.id);
                    table.ForeignKey(
                        name: "fk_invoice_extraction_invoice_invoice_id",
                        column: x => x.invoice_id,
                        principalSchema: "buyersystem",
                        principalTable: "invoice",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "location_material_threshold",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    location_material_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    month = table.Column<int>(type: "int", nullable: false),
                    minimum_stock = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    reorder_point = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_location_material_threshold", x => x.id);
                    table.ForeignKey(
                        name: "fk_location_material_threshold_inventory_location_material_location_material_id",
                        column: x => x.location_material_id,
                        principalSchema: "buyersystem",
                        principalTable: "inventory_location_material",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "material_price_change",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    request_number = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    material_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    current_unit_cost = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    proposed_unit_cost = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    currency = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    price_uom = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    effective_from = table.Column<DateTime>(type: "datetime2", nullable: true),
                    reason = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    status = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    requested_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    decided_on = table.Column<DateTime>(type: "datetime2", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_material_price_change", x => x.id);
                    table.ForeignKey(
                        name: "fk_material_price_change_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "physical_inventory_request",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    request_number = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    alert_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    reason = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    scheduled_date = table.Column<DateTime>(type: "datetime2", nullable: false),
                    status = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    stock_count_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    requested_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    assigned_user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_physical_inventory_request", x => x.id);
                    table.ForeignKey(
                        name: "fk_physical_inventory_request_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pos_source",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    pos_system = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    integration_kind = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    is_default = table.Column<bool>(type: "bit", nullable: false),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pos_source", x => x.id);
                    table.ForeignKey(
                        name: "fk_pos_source_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "quick_transfer_policy",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    enabled = table.Column<bool>(type: "bit", nullable: false),
                    maximum_quantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    skip_manager_approval = table.Column<bool>(type: "bit", nullable: false),
                    outlet_to_outlet_allowed = table.Column<bool>(type: "bit", nullable: false),
                    source_confirmation_required = table.Column<bool>(type: "bit", nullable: false),
                    maximum_value = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    destination_confirmation_required = table.Column<bool>(type: "bit", nullable: true),
                    manager_notification = table.Column<bool>(type: "bit", nullable: true),
                    allowed_source_types = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    allowed_destination_types = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_quick_transfer_policy", x => x.id);
                    table.ForeignKey(
                        name: "fk_quick_transfer_policy_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "recipe_category",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    code = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_recipe_category", x => x.id);
                    table.ForeignKey(
                        name: "fk_recipe_category_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "recipe_family",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    code = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_recipe_family", x => x.id);
                    table.ForeignKey(
                        name: "fk_recipe_family_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "recipe_substitution_proposal",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    proposal_number = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    recipe_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ingredient_material_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    suggested_material_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    reason = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    status = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    created_version = table.Column<int>(type: "int", nullable: true),
                    decided_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    decided_on = table.Column<DateTime>(type: "datetime2", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_recipe_substitution_proposal", x => x.id);
                    table.ForeignKey(
                        name: "fk_recipe_substitution_proposal_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "sila_approval_step",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    approval_type = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    reference_type = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    reference_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    order = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    comment = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    acted_on = table.Column<DateTime>(type: "datetime2", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sila_approval_step", x => x.id);
                    table.ForeignKey(
                        name: "fk_sila_approval_step_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "sila_document_sequence",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    prefix = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    last_number = table.Column<int>(type: "int", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sila_document_sequence", x => x.id);
                    table.ForeignKey(
                        name: "fk_sila_document_sequence_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "sila_ocr_configuration",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    provider = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    auto_extract_on_upload = table.Column<bool>(type: "bit", nullable: false),
                    minimum_confidence = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    amount_tolerance = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    backend_timeout_seconds = table.Column<int>(type: "int", nullable: true),
                    backend_retry_count = table.Column<int>(type: "int", nullable: true),
                    auto_fallback = table.Column<bool>(type: "bit", nullable: true),
                    always_backend_on_reread = table.Column<bool>(type: "bit", nullable: true),
                    detailed_line_extraction = table.Column<bool>(type: "bit", nullable: true),
                    supplier_validation = table.Column<bool>(type: "bit", nullable: true),
                    po_validation = table.Column<bool>(type: "bit", nullable: true),
                    financial_reconciliation = table.Column<bool>(type: "bit", nullable: true),
                    reuse_cached_ocr = table.Column<bool>(type: "bit", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sila_ocr_configuration", x => x.id);
                    table.ForeignKey(
                        name: "fk_sila_ocr_configuration_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "sila_supplier",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    supplier_code = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    tax_number = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    aliases = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    country = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    supplier_organization_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    legal_name = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    city = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    address = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    currency = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sila_supplier", x => x.id);
                    table.ForeignKey(
                        name: "fk_sila_supplier_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "stock_count_photo",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    stock_count_item_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    file_path = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    file_name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stock_count_photo", x => x.id);
                    table.ForeignKey(
                        name: "fk_stock_count_photo_stock_count_item_stock_count_item_id",
                        column: x => x.stock_count_item_id,
                        principalSchema: "buyersystem",
                        principalTable: "stock_count_item",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pos_item_mapping",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    pos_source_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    pos_item_code = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    pos_item_description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    recipe_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pos_item_mapping", x => x.id);
                    table.ForeignKey(
                        name: "fk_pos_item_mapping_pos_source_pos_source_id",
                        column: x => x.pos_source_id,
                        principalSchema: "buyersystem",
                        principalTable: "pos_source",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pos_outlet_mapping",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    pos_source_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    pos_outlet_code = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    pos_outlet_name = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    outlet_location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pos_outlet_mapping", x => x.id);
                    table.ForeignKey(
                        name: "fk_pos_outlet_mapping_pos_source_pos_source_id",
                        column: x => x.pos_source_id,
                        principalSchema: "buyersystem",
                        principalTable: "pos_source",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_stock_shortage_enquiry_buyer_id_enquiry_number",
                schema: "buyersystem",
                table: "stock_shortage_enquiry",
                columns: new[] { "buyer_id", "enquiry_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_stock_shortage_enquiry_buyer_id_location_id_status",
                schema: "buyersystem",
                table: "stock_shortage_enquiry",
                columns: new[] { "buyer_id", "location_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_stock_count_buyer_id_count_number",
                schema: "buyersystem",
                table: "stock_count",
                columns: new[] { "buyer_id", "count_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_stock_count_buyer_id_location_id_status",
                schema: "buyersystem",
                table: "stock_count",
                columns: new[] { "buyer_id", "location_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_stock_adjustment_buyer_id_adjustment_number",
                schema: "buyersystem",
                table: "stock_adjustment",
                columns: new[] { "buyer_id", "adjustment_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_stock_adjustment_buyer_id_location_id",
                schema: "buyersystem",
                table: "stock_adjustment",
                columns: new[] { "buyer_id", "location_id" });

            migrationBuilder.CreateIndex(
                name: "ix_pos_sales_transaction_batch_id",
                schema: "buyersystem",
                table: "pos_sales_transaction",
                column: "batch_id");

            migrationBuilder.CreateIndex(
                name: "ix_pos_sales_transaction_buyer_id_business_date",
                schema: "buyersystem",
                table: "pos_sales_transaction",
                columns: new[] { "buyer_id", "business_date" });

            migrationBuilder.CreateIndex(
                name: "ix_pos_sales_transaction_erp_posting_id",
                schema: "buyersystem",
                table: "pos_sales_transaction",
                column: "erp_posting_id");

            migrationBuilder.CreateIndex(
                name: "ix_pos_sales_batch_buyer_id_batch_number",
                schema: "buyersystem",
                table: "pos_sales_batch",
                columns: new[] { "buyer_id", "batch_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_invoice_buyer_id_content_hash",
                schema: "buyersystem",
                table: "invoice",
                columns: new[] { "buyer_id", "content_hash" });

            migrationBuilder.CreateIndex(
                name: "ix_invoice_buyer_id_status",
                schema: "buyersystem",
                table: "invoice",
                columns: new[] { "buyer_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_inventory_transaction_buyer_id_business_date",
                schema: "buyersystem",
                table: "inventory_transaction",
                columns: new[] { "buyer_id", "business_date" });

            migrationBuilder.CreateIndex(
                name: "ix_inventory_transaction_buyer_id_transaction_number",
                schema: "buyersystem",
                table: "inventory_transaction",
                columns: new[] { "buyer_id", "transaction_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_inventory_alert_location_id_alert_type_material_id_status",
                schema: "buyersystem",
                table: "inventory_alert",
                columns: new[] { "location_id", "alert_type", "material_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_internal_transfer_order_buyer_id_from_location_id_status",
                schema: "buyersystem",
                table: "internal_transfer_order",
                columns: new[] { "buyer_id", "from_location_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_internal_transfer_order_buyer_id_ito_number",
                schema: "buyersystem",
                table: "internal_transfer_order",
                columns: new[] { "buyer_id", "ito_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_internal_transfer_order_buyer_id_to_location_id_status",
                schema: "buyersystem",
                table: "internal_transfer_order",
                columns: new[] { "buyer_id", "to_location_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_goods_receipt_buyer_id_grn_number",
                schema: "buyersystem",
                table: "goods_receipt",
                columns: new[] { "buyer_id", "grn_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_goods_receipt_buyer_id_location_id",
                schema: "buyersystem",
                table: "goods_receipt",
                columns: new[] { "buyer_id", "location_id" });

            migrationBuilder.CreateIndex(
                name: "ix_goods_issue_buyer_id_from_location_id",
                schema: "buyersystem",
                table: "goods_issue",
                columns: new[] { "buyer_id", "from_location_id" });

            migrationBuilder.CreateIndex(
                name: "ix_goods_issue_buyer_id_issue_number",
                schema: "buyersystem",
                table: "goods_issue",
                columns: new[] { "buyer_id", "issue_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_goods_issue_buyer_id_to_location_id",
                schema: "buyersystem",
                table: "goods_issue",
                columns: new[] { "buyer_id", "to_location_id" });

            migrationBuilder.CreateIndex(
                name: "ix_company_code_master_buyer_id_code",
                schema: "buyersystem",
                table: "company_code_master",
                columns: new[] { "buyer_id", "code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_company_code_master_is_active",
                schema: "buyersystem",
                table: "company_code_master",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_internal_purchase_request_buyer_id_request_number",
                schema: "buyersystem",
                table: "internal_purchase_request",
                columns: new[] { "buyer_id", "request_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_internal_purchase_request_buyer_id_status",
                schema: "buyersystem",
                table: "internal_purchase_request",
                columns: new[] { "buyer_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_internal_purchase_request_is_active",
                schema: "buyersystem",
                table: "internal_purchase_request",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_invoice_extraction_invoice_id_attempt",
                schema: "buyersystem",
                table: "invoice_extraction",
                columns: new[] { "invoice_id", "attempt" });

            migrationBuilder.CreateIndex(
                name: "ix_invoice_extraction_is_active",
                schema: "buyersystem",
                table: "invoice_extraction",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_location_material_threshold_is_active",
                schema: "buyersystem",
                table: "location_material_threshold",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_location_material_threshold_location_material_id_month",
                schema: "buyersystem",
                table: "location_material_threshold",
                columns: new[] { "location_material_id", "month" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_material_price_change_buyer_id_request_number",
                schema: "buyersystem",
                table: "material_price_change",
                columns: new[] { "buyer_id", "request_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_material_price_change_is_active",
                schema: "buyersystem",
                table: "material_price_change",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_material_price_change_material_id_status",
                schema: "buyersystem",
                table: "material_price_change",
                columns: new[] { "material_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_physical_inventory_request_buyer_id_location_id_status",
                schema: "buyersystem",
                table: "physical_inventory_request",
                columns: new[] { "buyer_id", "location_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_physical_inventory_request_buyer_id_request_number",
                schema: "buyersystem",
                table: "physical_inventory_request",
                columns: new[] { "buyer_id", "request_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_physical_inventory_request_buyer_id_status",
                schema: "buyersystem",
                table: "physical_inventory_request",
                columns: new[] { "buyer_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_physical_inventory_request_is_active",
                schema: "buyersystem",
                table: "physical_inventory_request",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_pos_item_mapping_is_active",
                schema: "buyersystem",
                table: "pos_item_mapping",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_pos_item_mapping_pos_source_id_pos_item_code",
                schema: "buyersystem",
                table: "pos_item_mapping",
                columns: new[] { "pos_source_id", "pos_item_code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_pos_outlet_mapping_is_active",
                schema: "buyersystem",
                table: "pos_outlet_mapping",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_pos_outlet_mapping_pos_source_id_pos_outlet_code",
                schema: "buyersystem",
                table: "pos_outlet_mapping",
                columns: new[] { "pos_source_id", "pos_outlet_code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_pos_source_buyer_id",
                schema: "buyersystem",
                table: "pos_source",
                column: "buyer_id");

            migrationBuilder.CreateIndex(
                name: "ix_pos_source_is_active",
                schema: "buyersystem",
                table: "pos_source",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_quick_transfer_policy_buyer_id",
                schema: "buyersystem",
                table: "quick_transfer_policy",
                column: "buyer_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_quick_transfer_policy_is_active",
                schema: "buyersystem",
                table: "quick_transfer_policy",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_recipe_category_buyer_id_code",
                schema: "buyersystem",
                table: "recipe_category",
                columns: new[] { "buyer_id", "code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_recipe_category_is_active",
                schema: "buyersystem",
                table: "recipe_category",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_recipe_family_buyer_id_code",
                schema: "buyersystem",
                table: "recipe_family",
                columns: new[] { "buyer_id", "code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_recipe_family_is_active",
                schema: "buyersystem",
                table: "recipe_family",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_recipe_substitution_proposal_buyer_id_proposal_number",
                schema: "buyersystem",
                table: "recipe_substitution_proposal",
                columns: new[] { "buyer_id", "proposal_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_recipe_substitution_proposal_buyer_id_status",
                schema: "buyersystem",
                table: "recipe_substitution_proposal",
                columns: new[] { "buyer_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_recipe_substitution_proposal_is_active",
                schema: "buyersystem",
                table: "recipe_substitution_proposal",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_sila_approval_step_buyer_id_reference_type_status",
                schema: "buyersystem",
                table: "sila_approval_step",
                columns: new[] { "buyer_id", "reference_type", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_sila_approval_step_is_active",
                schema: "buyersystem",
                table: "sila_approval_step",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_sila_approval_step_reference_type_reference_id_version",
                schema: "buyersystem",
                table: "sila_approval_step",
                columns: new[] { "reference_type", "reference_id", "version" });

            migrationBuilder.CreateIndex(
                name: "ix_sila_approval_step_user_id_status",
                schema: "buyersystem",
                table: "sila_approval_step",
                columns: new[] { "user_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_sila_document_sequence_buyer_id_prefix",
                schema: "buyersystem",
                table: "sila_document_sequence",
                columns: new[] { "buyer_id", "prefix" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_sila_document_sequence_is_active",
                schema: "buyersystem",
                table: "sila_document_sequence",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_sila_ocr_configuration_buyer_id",
                schema: "buyersystem",
                table: "sila_ocr_configuration",
                column: "buyer_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_sila_ocr_configuration_is_active",
                schema: "buyersystem",
                table: "sila_ocr_configuration",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_sila_supplier_buyer_id_supplier_code",
                schema: "buyersystem",
                table: "sila_supplier",
                columns: new[] { "buyer_id", "supplier_code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_sila_supplier_is_active",
                schema: "buyersystem",
                table: "sila_supplier",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_stock_count_photo_is_active",
                schema: "buyersystem",
                table: "stock_count_photo",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_stock_count_photo_stock_count_item_id",
                schema: "buyersystem",
                table: "stock_count_photo",
                column: "stock_count_item_id");

            // Round-1 recipes: their rows become the selling version; approvals still open under the old table are resubmitted.
            migrationBuilder.Sql("UPDATE ri SET version = r.version FROM buyersystem.recipe_ingredient ri JOIN buyersystem.recipe r ON r.id = ri.recipe_id WHERE ri.version = 0");
            migrationBuilder.Sql("UPDATE rp SET version = r.version FROM buyersystem.recipe_outlet_price rp JOIN buyersystem.recipe r ON r.id = rp.recipe_id WHERE rp.version = 0");
            migrationBuilder.Sql("UPDATE buyersystem.recipe SET active_version = version WHERE status = 'APPROVED' AND active_version = 0");
            migrationBuilder.Sql("UPDATE buyersystem.recipe SET status = 'DRAFT', submitted_by = NULL, submitted_on = NULL WHERE status = 'PENDING_APPROVAL'");

            // Round-1 POS batches were processed in one step; round-1 counts take their creation day as business date.
            migrationBuilder.Sql("UPDATE buyersystem.pos_sales_batch SET status = 'PROCESSED' WHERE status = ''");
            migrationBuilder.Sql("UPDATE buyersystem.stock_count SET business_date = CAST(date_created AS date) WHERE business_date IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "company_code_master",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "internal_purchase_request",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "invoice_extraction",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "location_material_threshold",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "material_price_change",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "physical_inventory_request",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "pos_item_mapping",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "pos_outlet_mapping",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "quick_transfer_policy",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "recipe_category",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "recipe_family",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "recipe_substitution_proposal",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "sila_approval_step",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "sila_document_sequence",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "sila_ocr_configuration",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "sila_supplier",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "stock_count_photo",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "pos_source",
                schema: "buyersystem");

            migrationBuilder.DropIndex(
                name: "ix_stock_shortage_enquiry_buyer_id_enquiry_number",
                schema: "buyersystem",
                table: "stock_shortage_enquiry");

            migrationBuilder.DropIndex(
                name: "ix_stock_shortage_enquiry_buyer_id_location_id_status",
                schema: "buyersystem",
                table: "stock_shortage_enquiry");

            migrationBuilder.DropIndex(
                name: "ix_stock_count_buyer_id_count_number",
                schema: "buyersystem",
                table: "stock_count");

            migrationBuilder.DropIndex(
                name: "ix_stock_count_buyer_id_location_id_status",
                schema: "buyersystem",
                table: "stock_count");

            migrationBuilder.DropIndex(
                name: "ix_stock_adjustment_buyer_id_adjustment_number",
                schema: "buyersystem",
                table: "stock_adjustment");

            migrationBuilder.DropIndex(
                name: "ix_stock_adjustment_buyer_id_location_id",
                schema: "buyersystem",
                table: "stock_adjustment");

            migrationBuilder.DropIndex(
                name: "ix_pos_sales_transaction_batch_id",
                schema: "buyersystem",
                table: "pos_sales_transaction");

            migrationBuilder.DropIndex(
                name: "ix_pos_sales_transaction_buyer_id_business_date",
                schema: "buyersystem",
                table: "pos_sales_transaction");

            migrationBuilder.DropIndex(
                name: "ix_pos_sales_transaction_erp_posting_id",
                schema: "buyersystem",
                table: "pos_sales_transaction");

            migrationBuilder.DropIndex(
                name: "ix_pos_sales_batch_buyer_id_batch_number",
                schema: "buyersystem",
                table: "pos_sales_batch");

            migrationBuilder.DropIndex(
                name: "ix_invoice_buyer_id_content_hash",
                schema: "buyersystem",
                table: "invoice");

            migrationBuilder.DropIndex(
                name: "ix_invoice_buyer_id_status",
                schema: "buyersystem",
                table: "invoice");

            migrationBuilder.DropIndex(
                name: "ix_inventory_transaction_buyer_id_business_date",
                schema: "buyersystem",
                table: "inventory_transaction");

            migrationBuilder.DropIndex(
                name: "ix_inventory_transaction_buyer_id_transaction_number",
                schema: "buyersystem",
                table: "inventory_transaction");

            migrationBuilder.DropIndex(
                name: "ix_inventory_alert_location_id_alert_type_material_id_status",
                schema: "buyersystem",
                table: "inventory_alert");

            migrationBuilder.DropIndex(
                name: "ix_internal_transfer_order_buyer_id_from_location_id_status",
                schema: "buyersystem",
                table: "internal_transfer_order");

            migrationBuilder.DropIndex(
                name: "ix_internal_transfer_order_buyer_id_ito_number",
                schema: "buyersystem",
                table: "internal_transfer_order");

            migrationBuilder.DropIndex(
                name: "ix_internal_transfer_order_buyer_id_to_location_id_status",
                schema: "buyersystem",
                table: "internal_transfer_order");

            migrationBuilder.DropIndex(
                name: "ix_goods_receipt_buyer_id_grn_number",
                schema: "buyersystem",
                table: "goods_receipt");

            migrationBuilder.DropIndex(
                name: "ix_goods_receipt_buyer_id_location_id",
                schema: "buyersystem",
                table: "goods_receipt");

            migrationBuilder.DropIndex(
                name: "ix_goods_issue_buyer_id_from_location_id",
                schema: "buyersystem",
                table: "goods_issue");

            migrationBuilder.DropIndex(
                name: "ix_goods_issue_buyer_id_issue_number",
                schema: "buyersystem",
                table: "goods_issue");

            migrationBuilder.DropIndex(
                name: "ix_goods_issue_buyer_id_to_location_id",
                schema: "buyersystem",
                table: "goods_issue");

            migrationBuilder.DropColumn(
                name: "recount_requested",
                schema: "buyersystem",
                table: "stock_count_item");

            migrationBuilder.DropColumn(
                name: "review_comment",
                schema: "buyersystem",
                table: "stock_count_item");

            migrationBuilder.DropColumn(
                name: "review_status",
                schema: "buyersystem",
                table: "stock_count_item");

            migrationBuilder.DropColumn(
                name: "business_date",
                schema: "buyersystem",
                table: "stock_count");

            migrationBuilder.DropColumn(
                name: "version",
                schema: "buyersystem",
                table: "recipe_outlet_price");

            migrationBuilder.DropColumn(
                name: "version",
                schema: "buyersystem",
                table: "recipe_ingredient");

            migrationBuilder.DropColumn(
                name: "active_version",
                schema: "buyersystem",
                table: "recipe");

            migrationBuilder.DropColumn(
                name: "category_id",
                schema: "buyersystem",
                table: "recipe");

            migrationBuilder.DropColumn(
                name: "draft_name",
                schema: "buyersystem",
                table: "recipe");

            migrationBuilder.DropColumn(
                name: "draft_pos_code",
                schema: "buyersystem",
                table: "recipe");

            migrationBuilder.DropColumn(
                name: "draft_selling_uom",
                schema: "buyersystem",
                table: "recipe");

            migrationBuilder.DropColumn(
                name: "draft_serving_qty",
                schema: "buyersystem",
                table: "recipe");

            migrationBuilder.DropColumn(
                name: "draft_serving_uom",
                schema: "buyersystem",
                table: "recipe");

            migrationBuilder.DropColumn(
                name: "draft_total_cost",
                schema: "buyersystem",
                table: "recipe");

            migrationBuilder.DropColumn(
                name: "family_id",
                schema: "buyersystem",
                table: "recipe");

            migrationBuilder.DropColumn(
                name: "last_sale_date",
                schema: "buyersystem",
                table: "recipe");

            migrationBuilder.DropColumn(
                name: "pos_item",
                schema: "buyersystem",
                table: "recipe");

            migrationBuilder.DropColumn(
                name: "goods_receipt_expected",
                schema: "buyersystem",
                table: "purchase_order_item");

            migrationBuilder.DropColumn(
                name: "delivery_date",
                schema: "buyersystem",
                table: "purchase_order");

            migrationBuilder.DropColumn(
                name: "currency",
                schema: "buyersystem",
                table: "pos_sales_transaction");

            migrationBuilder.DropColumn(
                name: "recipe_version",
                schema: "buyersystem",
                table: "pos_sales_transaction");

            migrationBuilder.DropColumn(
                name: "uom",
                schema: "buyersystem",
                table: "pos_sales_transaction");

            migrationBuilder.DropColumn(
                name: "business_date_from",
                schema: "buyersystem",
                table: "pos_sales_batch");

            migrationBuilder.DropColumn(
                name: "business_date_to",
                schema: "buyersystem",
                table: "pos_sales_batch");

            migrationBuilder.DropColumn(
                name: "pos_source_id",
                schema: "buyersystem",
                table: "pos_sales_batch");

            migrationBuilder.DropColumn(
                name: "status",
                schema: "buyersystem",
                table: "pos_sales_batch");

            migrationBuilder.DropColumn(
                name: "scope_code",
                schema: "buyersystem",
                table: "master_approval_flow");

            migrationBuilder.DropColumn(
                name: "scope_id",
                schema: "buyersystem",
                table: "master_approval_flow");

            migrationBuilder.DropColumn(
                name: "scope_kind",
                schema: "buyersystem",
                table: "master_approval_flow");

            migrationBuilder.DropColumn(
                name: "batch_managed",
                schema: "buyersystem",
                table: "item_buyer_master");

            migrationBuilder.DropColumn(
                name: "company_code",
                schema: "buyersystem",
                table: "item_buyer_master");

            migrationBuilder.DropColumn(
                name: "expiry_managed",
                schema: "buyersystem",
                table: "item_buyer_master");

            migrationBuilder.DropColumn(
                name: "inventory_type",
                schema: "buyersystem",
                table: "item_buyer_master");

            migrationBuilder.DropColumn(
                name: "moving_average_price",
                schema: "buyersystem",
                table: "item_buyer_master");

            migrationBuilder.DropColumn(
                name: "serial_managed",
                schema: "buyersystem",
                table: "item_buyer_master");

            migrationBuilder.DropColumn(
                name: "shelf_life_days",
                schema: "buyersystem",
                table: "item_buyer_master");

            migrationBuilder.DropColumn(
                name: "source",
                schema: "buyersystem",
                table: "item_buyer_master");

            migrationBuilder.DropColumn(
                name: "standard_price",
                schema: "buyersystem",
                table: "item_buyer_master");

            migrationBuilder.DropColumn(
                name: "match_status",
                schema: "buyersystem",
                table: "invoice_item");

            migrationBuilder.DropColumn(
                name: "supplier_material_code",
                schema: "buyersystem",
                table: "invoice_item");

            migrationBuilder.DropColumn(
                name: "tax_rate",
                schema: "buyersystem",
                table: "invoice_item");

            migrationBuilder.DropColumn(
                name: "uom",
                schema: "buyersystem",
                table: "invoice_item");

            migrationBuilder.DropColumn(
                name: "content_hash",
                schema: "buyersystem",
                table: "invoice");

            migrationBuilder.DropColumn(
                name: "erp_posting_id",
                schema: "buyersystem",
                table: "invoice");

            migrationBuilder.DropColumn(
                name: "invoice_type",
                schema: "buyersystem",
                table: "invoice");

            migrationBuilder.DropColumn(
                name: "net_amount",
                schema: "buyersystem",
                table: "invoice");

            migrationBuilder.DropColumn(
                name: "sila_supplier_id",
                schema: "buyersystem",
                table: "invoice");

            migrationBuilder.DropColumn(
                name: "supplier_tax_number",
                schema: "buyersystem",
                table: "invoice");

            migrationBuilder.DropColumn(
                name: "tax_amount",
                schema: "buyersystem",
                table: "invoice");

            migrationBuilder.DropColumn(
                name: "maximum_stock",
                schema: "buyersystem",
                table: "inventory_location_material");

            migrationBuilder.DropColumn(
                name: "safety_stock",
                schema: "buyersystem",
                table: "inventory_location_material");

            migrationBuilder.DropColumn(
                name: "stocking_type",
                schema: "buyersystem",
                table: "inventory_location_material");

            migrationBuilder.DropColumn(
                name: "consumption_enabled",
                schema: "buyersystem",
                table: "inventory_location");

            migrationBuilder.DropColumn(
                name: "cost_center",
                schema: "buyersystem",
                table: "inventory_location");

            migrationBuilder.DropColumn(
                name: "description",
                schema: "buyersystem",
                table: "inventory_location");

            migrationBuilder.DropColumn(
                name: "gl_account",
                schema: "buyersystem",
                table: "inventory_location");

            migrationBuilder.DropColumn(
                name: "inventory_enabled",
                schema: "buyersystem",
                table: "inventory_location");

            migrationBuilder.DropColumn(
                name: "parent_location_id",
                schema: "buyersystem",
                table: "inventory_location");

            migrationBuilder.DropColumn(
                name: "profit_center",
                schema: "buyersystem",
                table: "inventory_location");

            migrationBuilder.DropColumn(
                name: "company_code",
                schema: "buyersystem",
                table: "inventory_erp_posting");

            migrationBuilder.DropColumn(
                name: "erp_http_status",
                schema: "buyersystem",
                table: "inventory_erp_posting");

            migrationBuilder.DropColumn(
                name: "erp_request_payload",
                schema: "buyersystem",
                table: "inventory_erp_posting");

            migrationBuilder.DropColumn(
                name: "erp_response_payload",
                schema: "buyersystem",
                table: "inventory_erp_posting");

            migrationBuilder.DropColumn(
                name: "integration_system",
                schema: "buyersystem",
                table: "inventory_erp_posting");

            migrationBuilder.DropColumn(
                name: "row_version",
                schema: "buyersystem",
                table: "inventory_balance");

            migrationBuilder.DropColumn(
                name: "already_collected",
                schema: "buyersystem",
                table: "internal_transfer_order");

            migrationBuilder.DropColumn(
                name: "dispute_reason",
                schema: "buyersystem",
                table: "internal_transfer_order");

            migrationBuilder.DropColumn(
                name: "batch_number",
                schema: "buyersystem",
                table: "goods_receipt_item");

            migrationBuilder.DropColumn(
                name: "expiry_date",
                schema: "buyersystem",
                table: "goods_receipt_item");

            migrationBuilder.DropColumn(
                name: "invoice_qty",
                schema: "buyersystem",
                table: "goods_receipt_item");

            migrationBuilder.DropColumn(
                name: "open_qty_before",
                schema: "buyersystem",
                table: "goods_receipt_item");

            migrationBuilder.AlterColumn<string>(
                name: "enquiry_number",
                schema: "buyersystem",
                table: "stock_shortage_enquiry",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.AlterColumn<string>(
                name: "count_number",
                schema: "buyersystem",
                table: "stock_count",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.AlterColumn<string>(
                name: "adjustment_number",
                schema: "buyersystem",
                table: "stock_adjustment",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.AlterColumn<string>(
                name: "batch_number",
                schema: "buyersystem",
                table: "pos_sales_batch",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.AlterColumn<string>(
                name: "status",
                schema: "buyersystem",
                table: "invoice",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.AlterColumn<string>(
                name: "transaction_number",
                schema: "buyersystem",
                table: "inventory_transaction",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.AlterColumn<string>(
                name: "alert_type",
                schema: "buyersystem",
                table: "inventory_alert",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.AlterColumn<string>(
                name: "ito_number",
                schema: "buyersystem",
                table: "internal_transfer_order",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.AlterColumn<string>(
                name: "grn_number",
                schema: "buyersystem",
                table: "goods_receipt",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.AlterColumn<string>(
                name: "issue_number",
                schema: "buyersystem",
                table: "goods_issue",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.CreateTable(
                name: "recipe_approval_user_mapping",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    recipe_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    acted_on = table.Column<DateTime>(type: "datetime2", nullable: true),
                    comment = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false),
                    order = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_recipe_approval_user_mapping", x => x.id);
                    table.ForeignKey(
                        name: "fk_recipe_approval_user_mapping_recipe_recipe_id",
                        column: x => x.recipe_id,
                        principalSchema: "buyersystem",
                        principalTable: "recipe",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_stock_adjustment_buyer_id",
                schema: "buyersystem",
                table: "stock_adjustment",
                column: "buyer_id");

            migrationBuilder.CreateIndex(
                name: "ix_pos_sales_batch_buyer_id",
                schema: "buyersystem",
                table: "pos_sales_batch",
                column: "buyer_id");

            migrationBuilder.CreateIndex(
                name: "ix_inventory_transaction_buyer_id",
                schema: "buyersystem",
                table: "inventory_transaction",
                column: "buyer_id");

            migrationBuilder.CreateIndex(
                name: "ix_goods_receipt_buyer_id",
                schema: "buyersystem",
                table: "goods_receipt",
                column: "buyer_id");

            migrationBuilder.CreateIndex(
                name: "ix_goods_issue_buyer_id",
                schema: "buyersystem",
                table: "goods_issue",
                column: "buyer_id");

            migrationBuilder.CreateIndex(
                name: "ix_recipe_approval_user_mapping_is_active",
                schema: "buyersystem",
                table: "recipe_approval_user_mapping",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_recipe_approval_user_mapping_recipe_id",
                schema: "buyersystem",
                table: "recipe_approval_user_mapping",
                column: "recipe_id");
        }
    }
}
