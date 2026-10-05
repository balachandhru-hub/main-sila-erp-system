using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Buyer.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SilaMeOperations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "received_quantity",
                schema: "buyersystem",
                table: "purchase_order_item",
                type: "decimal(18,4)",
                precision: 18,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "barcode",
                schema: "buyersystem",
                table: "item_buyer_master",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "currency",
                schema: "buyersystem",
                table: "item_buyer_master",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_inventory_item",
                schema: "buyersystem",
                table: "item_buyer_master",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "unit_cost",
                schema: "buyersystem",
                table: "item_buyer_master",
                type: "decimal(18,4)",
                precision: 18,
                scale: 4,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "goods_issue",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    issue_number = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    from_location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    to_location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    weekly_bucket_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    issued_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    comment = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_goods_issue", x => x.id);
                    table.ForeignKey(
                        name: "fk_goods_issue_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "goods_receipt",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    grn_number = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    purchase_order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    po_number = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    invoice_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    delivery_note = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    received_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    erp_posting_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_goods_receipt", x => x.id);
                    table.ForeignKey(
                        name: "fk_goods_receipt_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "internal_transfer_order",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ito_number = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    mode = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    from_location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    to_location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    status = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    required_by = table.Column<DateTime>(type: "datetime2", nullable: true),
                    requested_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    approved_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    approved_on = table.Column<DateTime>(type: "datetime2", nullable: true),
                    dispatched_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    dispatched_on = table.Column<DateTime>(type: "datetime2", nullable: true),
                    received_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    received_on = table.Column<DateTime>(type: "datetime2", nullable: true),
                    comment = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_internal_transfer_order", x => x.id);
                    table.ForeignKey(
                        name: "fk_internal_transfer_order_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "inventory_alert",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    alert_type = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    severity = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    status = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    title = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    message = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    material_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    reference_type = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    reference_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    recommended_action = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_inventory_alert", x => x.id);
                    table.ForeignKey(
                        name: "fk_inventory_alert_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "inventory_balance",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    material_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    on_hand_qty = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    in_transit_qty = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    base_uom = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    unit_cost = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    last_movement_on = table.Column<DateTime>(type: "datetime2", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_inventory_balance", x => x.id);
                    table.ForeignKey(
                        name: "fk_inventory_balance_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "inventory_erp_posting",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    reference_type = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    reference_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    reference_number = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    movement_type = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    status = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    attempts = table.Column<int>(type: "int", nullable: false),
                    erp_reference = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    error_message = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    posted_on = table.Column<DateTime>(type: "datetime2", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_inventory_erp_posting", x => x.id);
                    table.ForeignKey(
                        name: "fk_inventory_erp_posting_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "inventory_location",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    property_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    location_code = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    location_name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    location_type = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    outlet_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    store_category = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    storage_location_code = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    transfer_enabled = table.Column<bool>(type: "bit", nullable: false),
                    sales_enabled = table.Column<bool>(type: "bit", nullable: false),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_inventory_location", x => x.id);
                    table.ForeignKey(
                        name: "fk_inventory_location_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "inventory_transaction",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    transaction_number = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    transaction_type = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    material_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    direction = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    quantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    base_uom = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    entered_quantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    entered_uom = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    unit_cost = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    value = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    reference_type = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    reference_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    reference_number = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    business_date = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_inventory_transaction", x => x.id);
                    table.ForeignKey(
                        name: "fk_inventory_transaction_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "inventory_workflow_event",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    reference_type = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    reference_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    action = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    comment = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    actor_user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_inventory_workflow_event", x => x.id);
                    table.ForeignKey(
                        name: "fk_inventory_workflow_event_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "invoice",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    invoice_number = table.Column<string>(type: "nvarchar(450)", nullable: true),
                    supplier_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    supplier_name = table.Column<string>(type: "nvarchar(450)", nullable: true),
                    invoice_date = table.Column<DateTime>(type: "datetime2", nullable: true),
                    currency = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    gross_amount = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    purchase_order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    po_number = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    file_path = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    file_name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ocr_text = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ocr_confidence = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    uploaded_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_invoice", x => x.id);
                    table.ForeignKey(
                        name: "fk_invoice_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "material_uom_conversion",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    material_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    from_uom = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    to_uom = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    factor = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_material_uom_conversion", x => x.id);
                    table.ForeignKey(
                        name: "fk_material_uom_conversion_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pos_sales_batch",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    batch_number = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    source = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    file_name = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    rows = table.Column<int>(type: "int", nullable: false),
                    accepted = table.Column<int>(type: "int", nullable: false),
                    duplicates = table.Column<int>(type: "int", nullable: false),
                    invalid = table.Column<int>(type: "int", nullable: false),
                    uploaded_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pos_sales_batch", x => x.id);
                    table.ForeignKey(
                        name: "fk_pos_sales_batch_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pos_sales_transaction",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    batch_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    source_transaction_id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    line_number = table.Column<int>(type: "int", nullable: false),
                    business_date = table.Column<DateTime>(type: "datetime2", nullable: false),
                    outlet_code = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    outlet_location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    pos_code = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    recipe_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    quantity_sold = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    amount = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    status = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    failed_step = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    failure_message = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    erp_posting_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pos_sales_transaction", x => x.id);
                    table.ForeignKey(
                        name: "fk_pos_sales_transaction_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "recipe",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    recipe_code = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    category = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    item_mode = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    serving_qty = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    serving_uom = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    selling_uom = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    pos_code = table.Column<string>(type: "nvarchar(450)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    total_cost = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    currency = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    submitted_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    submitted_on = table.Column<DateTime>(type: "datetime2", nullable: true),
                    approved_on = table.Column<DateTime>(type: "datetime2", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_recipe", x => x.id);
                    table.ForeignKey(
                        name: "fk_recipe_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "stock_adjustment",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    adjustment_number = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    adjustment_type = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    posted_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stock_adjustment", x => x.id);
                    table.ForeignKey(
                        name: "fk_stock_adjustment_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "stock_count",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    count_number = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    count_type = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    blind_count = table.Column<bool>(type: "bit", nullable: false),
                    status = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    submitted_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    submitted_on = table.Column<DateTime>(type: "datetime2", nullable: true),
                    approved_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    approved_on = table.Column<DateTime>(type: "datetime2", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stock_count", x => x.id);
                    table.ForeignKey(
                        name: "fk_stock_count_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "stock_shortage_enquiry",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    enquiry_number = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    stock_count_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    stock_count_item_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    material_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    material_code = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    material_name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    shortage_qty = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    uom = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    status = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    justification_category = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    response = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    review_comment = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    responded_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    responded_on = table.Column<DateTime>(type: "datetime2", nullable: true),
                    reviewed_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    reviewed_on = table.Column<DateTime>(type: "datetime2", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stock_shortage_enquiry", x => x.id);
                    table.ForeignKey(
                        name: "fk_stock_shortage_enquiry_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "goods_issue_item",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    goods_issue_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    material_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    material_code = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    material_name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    quantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    uom = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    base_quantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_goods_issue_item", x => x.id);
                    table.ForeignKey(
                        name: "fk_goods_issue_item_goods_issue_goods_issue_id",
                        column: x => x.goods_issue_id,
                        principalSchema: "buyersystem",
                        principalTable: "goods_issue",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "goods_receipt_item",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    goods_receipt_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    purchase_order_item_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    material_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    material_code = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    material_name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ordered_qty = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    received_qty = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    accepted_qty = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    rejected_qty = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    damaged_qty = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    uom = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_goods_receipt_item", x => x.id);
                    table.ForeignKey(
                        name: "fk_goods_receipt_item_goods_receipt_goods_receipt_id",
                        column: x => x.goods_receipt_id,
                        principalSchema: "buyersystem",
                        principalTable: "goods_receipt",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "internal_transfer_order_item",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    internal_transfer_order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    material_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    material_code = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    material_name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    requested_qty = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    approved_qty = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    dispatched_qty = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    received_qty = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    uom = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_internal_transfer_order_item", x => x.id);
                    table.ForeignKey(
                        name: "fk_internal_transfer_order_item_internal_transfer_order_internal_transfer_order_id",
                        column: x => x.internal_transfer_order_id,
                        principalSchema: "buyersystem",
                        principalTable: "internal_transfer_order",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "inventory_location_material",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    material_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    minimum_stock = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    par_level = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    reorder_point = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_inventory_location_material", x => x.id);
                    table.ForeignKey(
                        name: "fk_inventory_location_material_inventory_location_location_id",
                        column: x => x.location_id,
                        principalSchema: "buyersystem",
                        principalTable: "inventory_location",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "inventory_location_user_mapping",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_inventory_location_user_mapping", x => x.id);
                    table.ForeignKey(
                        name: "fk_inventory_location_user_mapping_inventory_location_location_id",
                        column: x => x.location_id,
                        principalSchema: "buyersystem",
                        principalTable: "inventory_location",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "invoice_item",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    invoice_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    line_number = table.Column<int>(type: "int", nullable: false),
                    description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    quantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    unit_price = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    amount = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    purchase_order_item_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_invoice_item", x => x.id);
                    table.ForeignKey(
                        name: "fk_invoice_item_invoice_invoice_id",
                        column: x => x.invoice_id,
                        principalSchema: "buyersystem",
                        principalTable: "invoice",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "recipe_approval_user_mapping",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    recipe_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    version = table.Column<int>(type: "int", nullable: false),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    order = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<string>(type: "nvarchar(max)", nullable: false),
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
                    table.PrimaryKey("pk_recipe_approval_user_mapping", x => x.id);
                    table.ForeignKey(
                        name: "fk_recipe_approval_user_mapping_recipe_recipe_id",
                        column: x => x.recipe_id,
                        principalSchema: "buyersystem",
                        principalTable: "recipe",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "recipe_ingredient",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    recipe_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ingredient_code = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    material_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    sub_recipe_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    item_code = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    item_name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    quantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    uom = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    base_quantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    base_uom = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    unit_cost = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    cost = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    sequence = table.Column<int>(type: "int", nullable: false),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_recipe_ingredient", x => x.id);
                    table.ForeignKey(
                        name: "fk_recipe_ingredient_recipe_recipe_id",
                        column: x => x.recipe_id,
                        principalSchema: "buyersystem",
                        principalTable: "recipe",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "recipe_outlet_price",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    recipe_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    outlet_location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    menu_price = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    currency = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_recipe_outlet_price", x => x.id);
                    table.ForeignKey(
                        name: "fk_recipe_outlet_price_recipe_recipe_id",
                        column: x => x.recipe_id,
                        principalSchema: "buyersystem",
                        principalTable: "recipe",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "stock_adjustment_item",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    stock_adjustment_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    material_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    material_code = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    material_name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    quantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    uom = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    base_quantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    unit_cost = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stock_adjustment_item", x => x.id);
                    table.ForeignKey(
                        name: "fk_stock_adjustment_item_stock_adjustment_stock_adjustment_id",
                        column: x => x.stock_adjustment_id,
                        principalSchema: "buyersystem",
                        principalTable: "stock_adjustment",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "stock_count_item",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    stock_count_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    material_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    material_code = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    material_name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    base_uom = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    system_qty = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    counted_qty = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    variance_qty = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    unit_cost = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    variance_value = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    count_method = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    counted_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    counted_on = table.Column<DateTime>(type: "datetime2", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stock_count_item", x => x.id);
                    table.ForeignKey(
                        name: "fk_stock_count_item_stock_count_stock_count_id",
                        column: x => x.stock_count_id,
                        principalSchema: "buyersystem",
                        principalTable: "stock_count",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_goods_issue_buyer_id",
                schema: "buyersystem",
                table: "goods_issue",
                column: "buyer_id");

            migrationBuilder.CreateIndex(
                name: "ix_goods_issue_is_active",
                schema: "buyersystem",
                table: "goods_issue",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_goods_issue_item_goods_issue_id",
                schema: "buyersystem",
                table: "goods_issue_item",
                column: "goods_issue_id");

            migrationBuilder.CreateIndex(
                name: "ix_goods_issue_item_is_active",
                schema: "buyersystem",
                table: "goods_issue_item",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_goods_receipt_buyer_id",
                schema: "buyersystem",
                table: "goods_receipt",
                column: "buyer_id");

            migrationBuilder.CreateIndex(
                name: "ix_goods_receipt_is_active",
                schema: "buyersystem",
                table: "goods_receipt",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_goods_receipt_purchase_order_id",
                schema: "buyersystem",
                table: "goods_receipt",
                column: "purchase_order_id");

            migrationBuilder.CreateIndex(
                name: "ix_goods_receipt_item_goods_receipt_id",
                schema: "buyersystem",
                table: "goods_receipt_item",
                column: "goods_receipt_id");

            migrationBuilder.CreateIndex(
                name: "ix_goods_receipt_item_is_active",
                schema: "buyersystem",
                table: "goods_receipt_item",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_internal_transfer_order_buyer_id_status",
                schema: "buyersystem",
                table: "internal_transfer_order",
                columns: new[] { "buyer_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_internal_transfer_order_is_active",
                schema: "buyersystem",
                table: "internal_transfer_order",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_internal_transfer_order_item_internal_transfer_order_id",
                schema: "buyersystem",
                table: "internal_transfer_order_item",
                column: "internal_transfer_order_id");

            migrationBuilder.CreateIndex(
                name: "ix_internal_transfer_order_item_is_active",
                schema: "buyersystem",
                table: "internal_transfer_order_item",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_inventory_alert_buyer_id_status",
                schema: "buyersystem",
                table: "inventory_alert",
                columns: new[] { "buyer_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_inventory_alert_is_active",
                schema: "buyersystem",
                table: "inventory_alert",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_inventory_balance_buyer_id_material_id",
                schema: "buyersystem",
                table: "inventory_balance",
                columns: new[] { "buyer_id", "material_id" });

            migrationBuilder.CreateIndex(
                name: "ix_inventory_balance_is_active",
                schema: "buyersystem",
                table: "inventory_balance",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_inventory_balance_location_id_material_id",
                schema: "buyersystem",
                table: "inventory_balance",
                columns: new[] { "location_id", "material_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_inventory_erp_posting_buyer_id",
                schema: "buyersystem",
                table: "inventory_erp_posting",
                column: "buyer_id");

            migrationBuilder.CreateIndex(
                name: "ix_inventory_erp_posting_is_active",
                schema: "buyersystem",
                table: "inventory_erp_posting",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_inventory_erp_posting_reference_type_reference_id",
                schema: "buyersystem",
                table: "inventory_erp_posting",
                columns: new[] { "reference_type", "reference_id" });

            migrationBuilder.CreateIndex(
                name: "ix_inventory_erp_posting_status",
                schema: "buyersystem",
                table: "inventory_erp_posting",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_inventory_location_buyer_id_location_code",
                schema: "buyersystem",
                table: "inventory_location",
                columns: new[] { "buyer_id", "location_code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_inventory_location_is_active",
                schema: "buyersystem",
                table: "inventory_location",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_inventory_location_property_id",
                schema: "buyersystem",
                table: "inventory_location",
                column: "property_id");

            migrationBuilder.CreateIndex(
                name: "ix_inventory_location_material_is_active",
                schema: "buyersystem",
                table: "inventory_location_material",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_inventory_location_material_location_id_material_id",
                schema: "buyersystem",
                table: "inventory_location_material",
                columns: new[] { "location_id", "material_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_inventory_location_user_mapping_is_active",
                schema: "buyersystem",
                table: "inventory_location_user_mapping",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_inventory_location_user_mapping_location_id_user_id",
                schema: "buyersystem",
                table: "inventory_location_user_mapping",
                columns: new[] { "location_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_inventory_location_user_mapping_user_id",
                schema: "buyersystem",
                table: "inventory_location_user_mapping",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_inventory_transaction_buyer_id",
                schema: "buyersystem",
                table: "inventory_transaction",
                column: "buyer_id");

            migrationBuilder.CreateIndex(
                name: "ix_inventory_transaction_is_active",
                schema: "buyersystem",
                table: "inventory_transaction",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_inventory_transaction_location_id_material_id",
                schema: "buyersystem",
                table: "inventory_transaction",
                columns: new[] { "location_id", "material_id" });

            migrationBuilder.CreateIndex(
                name: "ix_inventory_transaction_reference_type_reference_id",
                schema: "buyersystem",
                table: "inventory_transaction",
                columns: new[] { "reference_type", "reference_id" });

            migrationBuilder.CreateIndex(
                name: "ix_inventory_workflow_event_buyer_id",
                schema: "buyersystem",
                table: "inventory_workflow_event",
                column: "buyer_id");

            migrationBuilder.CreateIndex(
                name: "ix_inventory_workflow_event_is_active",
                schema: "buyersystem",
                table: "inventory_workflow_event",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_inventory_workflow_event_reference_type_reference_id",
                schema: "buyersystem",
                table: "inventory_workflow_event",
                columns: new[] { "reference_type", "reference_id" });

            migrationBuilder.CreateIndex(
                name: "ix_invoice_buyer_id_supplier_name_invoice_number",
                schema: "buyersystem",
                table: "invoice",
                columns: new[] { "buyer_id", "supplier_name", "invoice_number" });

            migrationBuilder.CreateIndex(
                name: "ix_invoice_is_active",
                schema: "buyersystem",
                table: "invoice",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_invoice_item_invoice_id",
                schema: "buyersystem",
                table: "invoice_item",
                column: "invoice_id");

            migrationBuilder.CreateIndex(
                name: "ix_invoice_item_is_active",
                schema: "buyersystem",
                table: "invoice_item",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_material_uom_conversion_buyer_id",
                schema: "buyersystem",
                table: "material_uom_conversion",
                column: "buyer_id");

            migrationBuilder.CreateIndex(
                name: "ix_material_uom_conversion_is_active",
                schema: "buyersystem",
                table: "material_uom_conversion",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_material_uom_conversion_material_id_from_uom_to_uom",
                schema: "buyersystem",
                table: "material_uom_conversion",
                columns: new[] { "material_id", "from_uom", "to_uom" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_pos_sales_batch_buyer_id",
                schema: "buyersystem",
                table: "pos_sales_batch",
                column: "buyer_id");

            migrationBuilder.CreateIndex(
                name: "ix_pos_sales_batch_is_active",
                schema: "buyersystem",
                table: "pos_sales_batch",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_pos_sales_transaction_buyer_id_source_transaction_id_line_number",
                schema: "buyersystem",
                table: "pos_sales_transaction",
                columns: new[] { "buyer_id", "source_transaction_id", "line_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_pos_sales_transaction_buyer_id_status",
                schema: "buyersystem",
                table: "pos_sales_transaction",
                columns: new[] { "buyer_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_pos_sales_transaction_is_active",
                schema: "buyersystem",
                table: "pos_sales_transaction",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_recipe_buyer_id_pos_code",
                schema: "buyersystem",
                table: "recipe",
                columns: new[] { "buyer_id", "pos_code" });

            migrationBuilder.CreateIndex(
                name: "ix_recipe_buyer_id_recipe_code",
                schema: "buyersystem",
                table: "recipe",
                columns: new[] { "buyer_id", "recipe_code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_recipe_is_active",
                schema: "buyersystem",
                table: "recipe",
                column: "is_active");

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

            migrationBuilder.CreateIndex(
                name: "ix_recipe_ingredient_is_active",
                schema: "buyersystem",
                table: "recipe_ingredient",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_recipe_ingredient_recipe_id",
                schema: "buyersystem",
                table: "recipe_ingredient",
                column: "recipe_id");

            migrationBuilder.CreateIndex(
                name: "ix_recipe_outlet_price_is_active",
                schema: "buyersystem",
                table: "recipe_outlet_price",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_recipe_outlet_price_recipe_id",
                schema: "buyersystem",
                table: "recipe_outlet_price",
                column: "recipe_id");

            migrationBuilder.CreateIndex(
                name: "ix_stock_adjustment_buyer_id",
                schema: "buyersystem",
                table: "stock_adjustment",
                column: "buyer_id");

            migrationBuilder.CreateIndex(
                name: "ix_stock_adjustment_is_active",
                schema: "buyersystem",
                table: "stock_adjustment",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_stock_adjustment_item_is_active",
                schema: "buyersystem",
                table: "stock_adjustment_item",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_stock_adjustment_item_stock_adjustment_id",
                schema: "buyersystem",
                table: "stock_adjustment_item",
                column: "stock_adjustment_id");

            migrationBuilder.CreateIndex(
                name: "ix_stock_count_buyer_id_status",
                schema: "buyersystem",
                table: "stock_count",
                columns: new[] { "buyer_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_stock_count_is_active",
                schema: "buyersystem",
                table: "stock_count",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_stock_count_item_is_active",
                schema: "buyersystem",
                table: "stock_count_item",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_stock_count_item_stock_count_id",
                schema: "buyersystem",
                table: "stock_count_item",
                column: "stock_count_id");

            migrationBuilder.CreateIndex(
                name: "ix_stock_shortage_enquiry_buyer_id_status",
                schema: "buyersystem",
                table: "stock_shortage_enquiry",
                columns: new[] { "buyer_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_stock_shortage_enquiry_is_active",
                schema: "buyersystem",
                table: "stock_shortage_enquiry",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_stock_shortage_enquiry_stock_count_id",
                schema: "buyersystem",
                table: "stock_shortage_enquiry",
                column: "stock_count_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "goods_issue_item",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "goods_receipt_item",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "internal_transfer_order_item",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "inventory_alert",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "inventory_balance",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "inventory_erp_posting",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "inventory_location_material",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "inventory_location_user_mapping",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "inventory_transaction",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "inventory_workflow_event",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "invoice_item",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "material_uom_conversion",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "pos_sales_batch",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "pos_sales_transaction",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "recipe_approval_user_mapping",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "recipe_ingredient",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "recipe_outlet_price",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "stock_adjustment_item",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "stock_count_item",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "stock_shortage_enquiry",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "goods_issue",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "goods_receipt",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "internal_transfer_order",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "inventory_location",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "invoice",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "recipe",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "stock_adjustment",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "stock_count",
                schema: "buyersystem");

            migrationBuilder.DropColumn(
                name: "received_quantity",
                schema: "buyersystem",
                table: "purchase_order_item");

            migrationBuilder.DropColumn(
                name: "barcode",
                schema: "buyersystem",
                table: "item_buyer_master");

            migrationBuilder.DropColumn(
                name: "currency",
                schema: "buyersystem",
                table: "item_buyer_master");

            migrationBuilder.DropColumn(
                name: "is_inventory_item",
                schema: "buyersystem",
                table: "item_buyer_master");

            migrationBuilder.DropColumn(
                name: "unit_cost",
                schema: "buyersystem",
                table: "item_buyer_master");
        }
    }
}
