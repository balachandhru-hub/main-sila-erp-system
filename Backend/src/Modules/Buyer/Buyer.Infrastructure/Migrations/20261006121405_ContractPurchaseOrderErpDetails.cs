using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Buyer.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ContractPurchaseOrderErpDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The ERP document number of a contract purchase order keeps its data under its new name.
            migrationBuilder.RenameColumn(
                name: "erp_po_id",
                schema: "buyersystem",
                table: "purchase_order",
                newName: "erp_purchase_order_id");

            migrationBuilder.AddColumn<string>(
                name: "cost_center",
                schema: "buyersystem",
                table: "purchase_order_item",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "material_group",
                schema: "buyersystem",
                table: "purchase_order_item",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "erp_request_options",
                schema: "buyersystem",
                table: "purchase_order",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "cost_center",
                schema: "buyersystem",
                table: "purchase_order_item");

            migrationBuilder.DropColumn(
                name: "material_group",
                schema: "buyersystem",
                table: "purchase_order_item");

            migrationBuilder.DropColumn(
                name: "erp_request_options",
                schema: "buyersystem",
                table: "purchase_order");

            migrationBuilder.RenameColumn(
                name: "erp_purchase_order_id",
                schema: "buyersystem",
                table: "purchase_order",
                newName: "erp_po_id");
        }
    }
}
