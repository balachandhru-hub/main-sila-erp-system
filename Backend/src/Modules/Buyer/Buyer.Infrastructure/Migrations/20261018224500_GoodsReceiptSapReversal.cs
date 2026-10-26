using Buyer.Infrastructure.DbContext;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Buyer.Infrastructure.Migrations
{
    /// <summary>
    /// SAP Material Document fields for controlled GRN Cancel (101→102).
    /// Idempotent: UAT already had these columns before the migration history row was recorded.
    /// </summary>
    [DbContext(typeof(RepositoryContext))]
    [Migration("20261018224500_GoodsReceiptSapReversal")]
    public partial class GoodsReceiptSapReversal : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                IF COL_LENGTH('buyersystem.goods_receipt', 'material_document') IS NULL
                    ALTER TABLE buyersystem.goods_receipt ADD material_document nvarchar(20) NULL;
                IF COL_LENGTH('buyersystem.goods_receipt', 'material_document_year') IS NULL
                    ALTER TABLE buyersystem.goods_receipt ADD material_document_year nvarchar(4) NULL;
                IF COL_LENGTH('buyersystem.goods_receipt', 'reversal_material_document') IS NULL
                    ALTER TABLE buyersystem.goods_receipt ADD reversal_material_document nvarchar(20) NULL;
                IF COL_LENGTH('buyersystem.goods_receipt', 'reversal_material_document_year') IS NULL
                    ALTER TABLE buyersystem.goods_receipt ADD reversal_material_document_year nvarchar(4) NULL;
                IF COL_LENGTH('buyersystem.goods_receipt', 'reversal_erp_posting_id') IS NULL
                    ALTER TABLE buyersystem.goods_receipt ADD reversal_erp_posting_id uniqueidentifier NULL;
                IF COL_LENGTH('buyersystem.goods_receipt', 'reversal_status') IS NULL
                    ALTER TABLE buyersystem.goods_receipt ADD reversal_status nvarchar(40) NULL;
                IF COL_LENGTH('buyersystem.goods_receipt', 'reversal_reason') IS NULL
                    ALTER TABLE buyersystem.goods_receipt ADD reversal_reason nvarchar(500) NULL;
                IF COL_LENGTH('buyersystem.goods_receipt', 'reversed_on') IS NULL
                    ALTER TABLE buyersystem.goods_receipt ADD reversed_on datetime2 NULL;
                IF COL_LENGTH('buyersystem.goods_receipt', 'reversed_by') IS NULL
                    ALTER TABLE buyersystem.goods_receipt ADD reversed_by uniqueidentifier NULL;
                IF COL_LENGTH('buyersystem.goods_receipt_item', 'material_document_item') IS NULL
                    ALTER TABLE buyersystem.goods_receipt_item ADD material_document_item nvarchar(10) NULL;
                IF COL_LENGTH('buyersystem.goods_receipt_item', 'reversed_qty') IS NULL
                    ALTER TABLE buyersystem.goods_receipt_item ADD reversed_qty decimal(18,4) NOT NULL CONSTRAINT DF_goods_receipt_item_reversed_qty DEFAULT (0);
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                IF COL_LENGTH('buyersystem.goods_receipt_item', 'reversed_qty') IS NOT NULL
                    ALTER TABLE buyersystem.goods_receipt_item DROP CONSTRAINT IF EXISTS DF_goods_receipt_item_reversed_qty;
                IF COL_LENGTH('buyersystem.goods_receipt_item', 'reversed_qty') IS NOT NULL
                    ALTER TABLE buyersystem.goods_receipt_item DROP COLUMN reversed_qty;
                IF COL_LENGTH('buyersystem.goods_receipt_item', 'material_document_item') IS NOT NULL
                    ALTER TABLE buyersystem.goods_receipt_item DROP COLUMN material_document_item;
                IF COL_LENGTH('buyersystem.goods_receipt', 'reversed_by') IS NOT NULL
                    ALTER TABLE buyersystem.goods_receipt DROP COLUMN reversed_by;
                IF COL_LENGTH('buyersystem.goods_receipt', 'reversed_on') IS NOT NULL
                    ALTER TABLE buyersystem.goods_receipt DROP COLUMN reversed_on;
                IF COL_LENGTH('buyersystem.goods_receipt', 'reversal_reason') IS NOT NULL
                    ALTER TABLE buyersystem.goods_receipt DROP COLUMN reversal_reason;
                IF COL_LENGTH('buyersystem.goods_receipt', 'reversal_status') IS NOT NULL
                    ALTER TABLE buyersystem.goods_receipt DROP COLUMN reversal_status;
                IF COL_LENGTH('buyersystem.goods_receipt', 'reversal_erp_posting_id') IS NOT NULL
                    ALTER TABLE buyersystem.goods_receipt DROP COLUMN reversal_erp_posting_id;
                IF COL_LENGTH('buyersystem.goods_receipt', 'reversal_material_document_year') IS NOT NULL
                    ALTER TABLE buyersystem.goods_receipt DROP COLUMN reversal_material_document_year;
                IF COL_LENGTH('buyersystem.goods_receipt', 'reversal_material_document') IS NOT NULL
                    ALTER TABLE buyersystem.goods_receipt DROP COLUMN reversal_material_document;
                IF COL_LENGTH('buyersystem.goods_receipt', 'material_document_year') IS NOT NULL
                    ALTER TABLE buyersystem.goods_receipt DROP COLUMN material_document_year;
                IF COL_LENGTH('buyersystem.goods_receipt', 'material_document') IS NOT NULL
                    ALTER TABLE buyersystem.goods_receipt DROP COLUMN material_document;
                """);
        }
    }
}
