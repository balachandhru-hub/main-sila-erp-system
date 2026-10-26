using Buyer.Infrastructure.DbContext;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Buyer.Infrastructure.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(RepositoryContext))]
    [Migration("20261018220000_InvoiceCreatePoNonPo")]
    public partial class InvoiceCreatePoNonPo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "creation_type",
                schema: "buyersystem",
                table: "invoice",
                type: "nvarchar(450)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "company_code",
                schema: "buyersystem",
                table: "invoice",
                type: "nvarchar(450)",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "property_id",
                schema: "buyersystem",
                table: "invoice",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "tax_code",
                schema: "buyersystem",
                table: "invoice_item",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "gl_account",
                schema: "buyersystem",
                table: "invoice_item",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "cost_center",
                schema: "buyersystem",
                table: "invoice_item",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "profit_center",
                schema: "buyersystem",
                table: "invoice_item",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "internal_order",
                schema: "buyersystem",
                table: "invoice_item",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "wbs_element",
                schema: "buyersystem",
                table: "invoice_item",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "business_area",
                schema: "buyersystem",
                table: "invoice_item",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "assignment_reference",
                schema: "buyersystem",
                table: "invoice_item",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "debit_credit_code",
                schema: "buyersystem",
                table: "invoice_item",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "line_text",
                schema: "buyersystem",
                table: "invoice_item",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "goods_receipt_item_id",
                schema: "buyersystem",
                table: "invoice_item",
                type: "uniqueidentifier",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "creation_type", schema: "buyersystem", table: "invoice");
            migrationBuilder.DropColumn(name: "company_code", schema: "buyersystem", table: "invoice");
            migrationBuilder.DropColumn(name: "property_id", schema: "buyersystem", table: "invoice");
            migrationBuilder.DropColumn(name: "tax_code", schema: "buyersystem", table: "invoice_item");
            migrationBuilder.DropColumn(name: "gl_account", schema: "buyersystem", table: "invoice_item");
            migrationBuilder.DropColumn(name: "cost_center", schema: "buyersystem", table: "invoice_item");
            migrationBuilder.DropColumn(name: "profit_center", schema: "buyersystem", table: "invoice_item");
            migrationBuilder.DropColumn(name: "internal_order", schema: "buyersystem", table: "invoice_item");
            migrationBuilder.DropColumn(name: "wbs_element", schema: "buyersystem", table: "invoice_item");
            migrationBuilder.DropColumn(name: "business_area", schema: "buyersystem", table: "invoice_item");
            migrationBuilder.DropColumn(name: "assignment_reference", schema: "buyersystem", table: "invoice_item");
            migrationBuilder.DropColumn(name: "debit_credit_code", schema: "buyersystem", table: "invoice_item");
            migrationBuilder.DropColumn(name: "line_text", schema: "buyersystem", table: "invoice_item");
            migrationBuilder.DropColumn(name: "goods_receipt_item_id", schema: "buyersystem", table: "invoice_item");
        }
    }
}
