using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Buyer.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class BuyerIntegrationBuyerId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "organization_id",
                schema: "buyersystem",
                table: "api_integration_configuration",
                newName: "buyer_id");

            migrationBuilder.RenameIndex(
                name: "ix_api_integration_configuration_organization_id_entity_code_process_type",
                schema: "buyersystem",
                table: "api_integration_configuration",
                newName: "ix_api_integration_configuration_buyer_id_entity_code_process_type");

            // The column held the organization id; it now holds the buyer profile id of that organization.
            migrationBuilder.Sql(@"UPDATE c SET c.buyer_id = b.id
FROM [buyersystem].[api_integration_configuration] c
INNER JOIN [buyersystem].[buyer_business_profile] b ON b.organization_id = c.buyer_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"UPDATE c SET c.buyer_id = b.organization_id
FROM [buyersystem].[api_integration_configuration] c
INNER JOIN [buyersystem].[buyer_business_profile] b ON b.id = c.buyer_id");

            migrationBuilder.RenameColumn(
                name: "buyer_id",
                schema: "buyersystem",
                table: "api_integration_configuration",
                newName: "organization_id");

            migrationBuilder.RenameIndex(
                name: "ix_api_integration_configuration_buyer_id_entity_code_process_type",
                schema: "buyersystem",
                table: "api_integration_configuration",
                newName: "ix_api_integration_configuration_organization_id_entity_code_process_type");
        }
    }
}
