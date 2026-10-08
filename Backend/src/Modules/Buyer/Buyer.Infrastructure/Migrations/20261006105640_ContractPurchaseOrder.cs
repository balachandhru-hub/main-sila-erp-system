using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Buyer.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ContractPurchaseOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_purchase_document_integration_weekly_bucket_id_integration_type_supplier_organization_id",
                schema: "buyersystem",
                table: "purchase_document_integration");

            migrationBuilder.AddColumn<Guid>(
                name: "contract_id",
                schema: "buyersystem",
                table: "purchase_order",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "erp_po_id",
                schema: "buyersystem",
                table: "purchase_order",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "weekly_bucket_id",
                schema: "buyersystem",
                table: "purchase_document_integration",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<Guid>(
                name: "contract_id",
                schema: "buyersystem",
                table: "purchase_document_integration",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "purchase_order_id",
                schema: "buyersystem",
                table: "purchase_document_integration",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_purchase_order_contract_id",
                schema: "buyersystem",
                table: "purchase_order",
                column: "contract_id");

            migrationBuilder.CreateIndex(
                name: "ix_purchase_document_integration_purchase_order_id_integration_type",
                schema: "buyersystem",
                table: "purchase_document_integration",
                columns: new[] { "purchase_order_id", "integration_type" },
                unique: true,
                filter: "[purchase_order_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_purchase_document_integration_weekly_bucket_id_integration_type_supplier_organization_id",
                schema: "buyersystem",
                table: "purchase_document_integration",
                columns: new[] { "weekly_bucket_id", "integration_type", "supplier_organization_id" },
                unique: true,
                filter: "[weekly_bucket_id] IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "fk_purchase_order_predefined_contract_contract_id",
                schema: "buyersystem",
                table: "purchase_order",
                column: "contract_id",
                principalSchema: "buyersystem",
                principalTable: "predefined_contract",
                principalColumn: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_purchase_order_predefined_contract_contract_id",
                schema: "buyersystem",
                table: "purchase_order");

            migrationBuilder.DropIndex(
                name: "ix_purchase_order_contract_id",
                schema: "buyersystem",
                table: "purchase_order");

            migrationBuilder.DropIndex(
                name: "ix_purchase_document_integration_purchase_order_id_integration_type",
                schema: "buyersystem",
                table: "purchase_document_integration");

            migrationBuilder.DropIndex(
                name: "ix_purchase_document_integration_weekly_bucket_id_integration_type_supplier_organization_id",
                schema: "buyersystem",
                table: "purchase_document_integration");

            migrationBuilder.DropColumn(
                name: "contract_id",
                schema: "buyersystem",
                table: "purchase_order");

            migrationBuilder.DropColumn(
                name: "erp_po_id",
                schema: "buyersystem",
                table: "purchase_order");

            migrationBuilder.DropColumn(
                name: "contract_id",
                schema: "buyersystem",
                table: "purchase_document_integration");

            migrationBuilder.DropColumn(
                name: "purchase_order_id",
                schema: "buyersystem",
                table: "purchase_document_integration");

            migrationBuilder.AlterColumn<Guid>(
                name: "weekly_bucket_id",
                schema: "buyersystem",
                table: "purchase_document_integration",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_purchase_document_integration_weekly_bucket_id_integration_type_supplier_organization_id",
                schema: "buyersystem",
                table: "purchase_document_integration",
                columns: new[] { "weekly_bucket_id", "integration_type", "supplier_organization_id" },
                unique: true);
        }
    }
}
