using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Buyer.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SilaMaterialOutletPrice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "outlet_location_id",
                schema: "buyersystem",
                table: "material_price_change",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "material_outlet_price",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    material_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    outlet_location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    unit_cost = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    currency = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_material_outlet_price", x => x.id);
                    table.ForeignKey(
                        name: "fk_material_outlet_price_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_material_outlet_price_buyer_id_material_id_outlet_location_id",
                schema: "buyersystem",
                table: "material_outlet_price",
                columns: new[] { "buyer_id", "material_id", "outlet_location_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_material_outlet_price_is_active",
                schema: "buyersystem",
                table: "material_outlet_price",
                column: "is_active");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "material_outlet_price",
                schema: "buyersystem");

            migrationBuilder.DropColumn(
                name: "outlet_location_id",
                schema: "buyersystem",
                table: "material_price_change");
        }
    }
}
