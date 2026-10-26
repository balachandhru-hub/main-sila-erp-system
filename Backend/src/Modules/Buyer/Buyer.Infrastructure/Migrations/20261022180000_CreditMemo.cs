using Buyer.Infrastructure.DbContext;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Buyer.Infrastructure.Migrations
{
    [DbContext(typeof(RepositoryContext))]
    [Migration("20261022180000_CreditMemo")]
    public partial class CreditMemo : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "credit_memo",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    reference_invoice_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    credit_memo_number = table.Column<string>(type: "nvarchar(450)", nullable: true),
                    credit_memo_reference = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    reference_supplier_invoice_number = table.Column<string>(type: "nvarchar(450)", nullable: true),
                    reference_erp_invoice_id = table.Column<string>(type: "nvarchar(450)", nullable: true),
                    reference_fiscal_year = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    supplier_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    sila_supplier_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    supplier_name = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    purchase_order_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    po_number = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    company_code = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    currency = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    document_date = table.Column<DateTime>(type: "datetime2", nullable: true),
                    posting_date = table.Column<DateTime>(type: "datetime2", nullable: true),
                    tax_calculation_date = table.Column<DateTime>(type: "datetime2", nullable: true),
                    reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    gross_amount = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    status = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    posting_data = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    erp_posting_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_by_user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_credit_memo", x => x.id);
                    table.ForeignKey(
                        name: "fk_credit_memo_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "credit_memo_item",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    credit_memo_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    reference_invoice_line_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    line_number = table.Column<int>(type: "int", nullable: false),
                    po_number = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    po_item = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    material = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    quantity = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    uom = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    amount = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: true),
                    tax_code = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_credit_memo_item", x => x.id);
                    table.ForeignKey(
                        name: "fk_credit_memo_item_credit_memo_credit_memo_id",
                        column: x => x.credit_memo_id,
                        principalSchema: "buyersystem",
                        principalTable: "credit_memo",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_credit_memo_is_active",
                schema: "buyersystem",
                table: "credit_memo",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_credit_memo_buyer_id_reference_invoice_id",
                schema: "buyersystem",
                table: "credit_memo",
                columns: new[] { "buyer_id", "reference_invoice_id" });

            migrationBuilder.CreateIndex(
                name: "ix_credit_memo_item_is_active",
                schema: "buyersystem",
                table: "credit_memo_item",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_credit_memo_item_credit_memo_id",
                schema: "buyersystem",
                table: "credit_memo_item",
                column: "credit_memo_id");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "credit_memo_item",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "credit_memo",
                schema: "buyersystem");
        }
    }
}
