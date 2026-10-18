using Buyer.Infrastructure.DbContext;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Buyer.Infrastructure.Migrations
{
    [DbContext(typeof(RepositoryContext))]
    [Migration("20261018224500_GoodsReceiptSapReversal")]
    public partial class GoodsReceiptSapReversal : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(name: "material_document", schema: "buyersystem", table: "goods_receipt", type: "nvarchar(20)", nullable: true);
            migrationBuilder.AddColumn<string>(name: "material_document_year", schema: "buyersystem", table: "goods_receipt", type: "nvarchar(4)", nullable: true);
            migrationBuilder.AddColumn<string>(name: "reversal_material_document", schema: "buyersystem", table: "goods_receipt", type: "nvarchar(20)", nullable: true);
            migrationBuilder.AddColumn<string>(name: "reversal_material_document_year", schema: "buyersystem", table: "goods_receipt", type: "nvarchar(4)", nullable: true);
            migrationBuilder.AddColumn<Guid>(name: "reversal_erp_posting_id", schema: "buyersystem", table: "goods_receipt", type: "uniqueidentifier", nullable: true);
            migrationBuilder.AddColumn<string>(name: "reversal_status", schema: "buyersystem", table: "goods_receipt", type: "nvarchar(40)", nullable: true);
            migrationBuilder.AddColumn<string>(name: "reversal_reason", schema: "buyersystem", table: "goods_receipt", type: "nvarchar(500)", nullable: true);
            migrationBuilder.AddColumn<DateTime>(name: "reversed_on", schema: "buyersystem", table: "goods_receipt", type: "datetime2", nullable: true);
            migrationBuilder.AddColumn<Guid>(name: "reversed_by", schema: "buyersystem", table: "goods_receipt", type: "uniqueidentifier", nullable: true);
            migrationBuilder.AddColumn<string>(name: "material_document_item", schema: "buyersystem", table: "goods_receipt_item", type: "nvarchar(10)", nullable: true);
            migrationBuilder.AddColumn<decimal>(name: "reversed_qty", schema: "buyersystem", table: "goods_receipt_item", type: "decimal(18,4)", precision: 18, scale: 4, nullable: false, defaultValue: 0m);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "material_document", schema: "buyersystem", table: "goods_receipt");
            migrationBuilder.DropColumn(name: "material_document_year", schema: "buyersystem", table: "goods_receipt");
            migrationBuilder.DropColumn(name: "reversal_material_document", schema: "buyersystem", table: "goods_receipt");
            migrationBuilder.DropColumn(name: "reversal_material_document_year", schema: "buyersystem", table: "goods_receipt");
            migrationBuilder.DropColumn(name: "reversal_erp_posting_id", schema: "buyersystem", table: "goods_receipt");
            migrationBuilder.DropColumn(name: "reversal_status", schema: "buyersystem", table: "goods_receipt");
            migrationBuilder.DropColumn(name: "reversal_reason", schema: "buyersystem", table: "goods_receipt");
            migrationBuilder.DropColumn(name: "reversed_on", schema: "buyersystem", table: "goods_receipt");
            migrationBuilder.DropColumn(name: "reversed_by", schema: "buyersystem", table: "goods_receipt");
            migrationBuilder.DropColumn(name: "material_document_item", schema: "buyersystem", table: "goods_receipt_item");
            migrationBuilder.DropColumn(name: "reversed_qty", schema: "buyersystem", table: "goods_receipt_item");
        }
    }
}
