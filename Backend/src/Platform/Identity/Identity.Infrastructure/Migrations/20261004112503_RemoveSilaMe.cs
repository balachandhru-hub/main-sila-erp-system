using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Identity.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveSilaMe : Migration
    {
        /// <summary>
        /// Removes what belonged to the SILA ME (Operations) service, which no longer exists. Seeding
        /// only adds and updates rows, so rows removed from the seed files are deleted here.
        /// </summary>
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The Operations permissions and their role mappings.
            migrationBuilder.Sql(@"
DELETE rfm FROM [identitysystem].[role_feature_mapping] rfm
INNER JOIN [identitysystem].[feature] f ON f.[id] = rfm.[feature_id]
WHERE f.[key] LIKE 'OPERATIONS[_]%';

DELETE FROM [identitysystem].[feature] WHERE [key] LIKE 'OPERATIONS[_]%';");

            // The SILA HORECA recipe management model and its organization mappings.
            migrationBuilder.Sql(@"
DELETE omm FROM [identitysystem].[organization_model_mapping] omm
INNER JOIN [identitysystem].[model_mapping] mm ON mm.[id] = omm.[model_id]
WHERE mm.[key] = 'SILA_HORECA_RECIPE_MANAGEMENT';

DELETE FROM [identitysystem].[model_mapping] WHERE [key] = 'SILA_HORECA_RECIPE_MANAGEMENT';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // The removed rows belonged to a service that no longer exists; they are not restored.
        }
    }
}
