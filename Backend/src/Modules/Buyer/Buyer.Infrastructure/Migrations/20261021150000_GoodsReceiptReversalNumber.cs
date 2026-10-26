using Buyer.Infrastructure.DbContext;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Buyer.Infrastructure.Migrations
{
    /// <summary>
    /// Linked reversal GR** number (GR000008 reversed → GR000009).
    /// </summary>
    [DbContext(typeof(RepositoryContext))]
    [Migration("20261021150000_GoodsReceiptReversalNumber")]
    public partial class GoodsReceiptReversalNumber : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                IF COL_LENGTH('buyersystem.goods_receipt', 'parent_goods_receipt_id') IS NULL
                    ALTER TABLE buyersystem.goods_receipt ADD parent_goods_receipt_id uniqueidentifier NULL;
                IF COL_LENGTH('buyersystem.goods_receipt', 'reversal_grn_number') IS NULL
                    ALTER TABLE buyersystem.goods_receipt ADD reversal_grn_number nvarchar(20) NULL;
                IF COL_LENGTH('buyersystem.goods_receipt', 'reversal_goods_receipt_id') IS NULL
                    ALTER TABLE buyersystem.goods_receipt ADD reversal_goods_receipt_id uniqueidentifier NULL;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                IF COL_LENGTH('buyersystem.goods_receipt', 'reversal_goods_receipt_id') IS NOT NULL
                    ALTER TABLE buyersystem.goods_receipt DROP COLUMN reversal_goods_receipt_id;
                IF COL_LENGTH('buyersystem.goods_receipt', 'reversal_grn_number') IS NOT NULL
                    ALTER TABLE buyersystem.goods_receipt DROP COLUMN reversal_grn_number;
                IF COL_LENGTH('buyersystem.goods_receipt', 'parent_goods_receipt_id') IS NOT NULL
                    ALTER TABLE buyersystem.goods_receipt DROP COLUMN parent_goods_receipt_id;
                """);
        }
    }
}
