using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Buyer.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ContractErpContractId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "erp_contract_id",
                schema: "buyersystem",
                table: "predefined_contract",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_purchase_document_integration_contract_id_integration_type",
                schema: "buyersystem",
                table: "purchase_document_integration",
                columns: new[] { "contract_id", "integration_type" },
                unique: true,
                filter: "[integration_type] = 'CONTRACT_CREATE'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_purchase_document_integration_contract_id_integration_type",
                schema: "buyersystem",
                table: "purchase_document_integration");

            migrationBuilder.DropColumn(
                name: "erp_contract_id",
                schema: "buyersystem",
                table: "predefined_contract");
        }
    }
}
