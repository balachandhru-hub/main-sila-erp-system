using Buyer.Infrastructure.DbContext;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Buyer.Infrastructure.Migrations
{
    [DbContext(typeof(RepositoryContext))]
    [Migration("20261025020000_MenuEngineering")]
    public partial class MenuEngineering : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "menu_item",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    menu_item_code = table.Column<string>(type: "nvarchar(40)", nullable: false),
                    name = table.Column<string>(type: "nvarchar(200)", nullable: false),
                    description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    category = table.Column<string>(type: "nvarchar(80)", nullable: true),
                    sub_category = table.Column<string>(type: "nvarchar(80)", nullable: true),
                    cuisine = table.Column<string>(type: "nvarchar(80)", nullable: true),
                    classification = table.Column<string>(type: "nvarchar(40)", nullable: true),
                    meal_periods = table.Column<string>(type: "nvarchar(400)", nullable: true),
                    selling_price = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    currency = table.Column<string>(type: "nvarchar(10)", nullable: true),
                    default_portion_qty = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    portion_uom = table.Column<string>(type: "nvarchar(20)", nullable: true),
                    adult_portion_factor = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    child_portion_factor = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    default_participation_rate = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    default_buffer_percentage = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    service_type = table.Column<string>(type: "nvarchar(80)", nullable: true),
                    dietary_tags = table.Column<string>(type: "nvarchar(400)", nullable: true),
                    allergen_notes = table.Column<string>(type: "nvarchar(400)", nullable: true),
                    image_path = table.Column<string>(type: "nvarchar(400)", nullable: true),
                    property_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    outlet_location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    effective_from = table.Column<DateTime>(type: "datetime2", nullable: true),
                    effective_to = table.Column<DateTime>(type: "datetime2", nullable: true),
                    status = table.Column<string>(type: "nvarchar(40)", nullable: false),
                    linked_recipe_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    recipe_link_status = table.Column<string>(type: "nvarchar(40)", nullable: false),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_menu_item", x => x.id);
                    table.ForeignKey(
                        name: "fk_menu_item_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "menu_plan",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    plan_code = table.Column<string>(type: "nvarchar(40)", nullable: false),
                    name = table.Column<string>(type: "nvarchar(200)", nullable: false),
                    property_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    outlet_location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    business_date = table.Column<DateTime>(type: "datetime2", nullable: false),
                    start_date = table.Column<DateTime>(type: "datetime2", nullable: true),
                    end_date = table.Column<DateTime>(type: "datetime2", nullable: true),
                    meal_period = table.Column<string>(type: "nvarchar(80)", nullable: true),
                    event_name = table.Column<string>(type: "nvarchar(200)", nullable: true),
                    expected_guests = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    expected_covers = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    meal_participation = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(40)", nullable: false),
                    notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    copied_from_plan_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_menu_plan", x => x.id);
                    table.ForeignKey(
                        name: "fk_menu_plan_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "menu_plan_line",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    menu_plan_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    menu_item_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    participation_rate = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    buffer_percentage = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    adult_factor = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    child_factor = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    recommended_portions = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    planned_portions = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    portions_confirmed = table.Column<bool>(type: "bit", nullable: false),
                    override_reason = table.Column<string>(type: "nvarchar(400)", nullable: true),
                    actual_portions = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    warning = table.Column<string>(type: "nvarchar(400)", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_menu_plan_line", x => x.id);
                    table.ForeignKey(
                        name: "fk_menu_plan_line_menu_plan_menu_plan_id",
                        column: x => x.menu_plan_id,
                        principalSchema: "buyersystem",
                        principalTable: "menu_plan",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "menu_pos_mapping",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    pos_code = table.Column<string>(type: "nvarchar(80)", nullable: false),
                    pos_description = table.Column<string>(type: "nvarchar(200)", nullable: true),
                    outlet_location_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    menu_item_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    effective_from = table.Column<DateTime>(type: "datetime2", nullable: true),
                    effective_to = table.Column<DateTime>(type: "datetime2", nullable: true),
                    status = table.Column<string>(type: "nvarchar(40)", nullable: false),
                    mapping_source = table.Column<string>(type: "nvarchar(40)", nullable: true),
                    suggestion_confidence = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    suggested_menu_item_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_menu_pos_mapping", x => x.id);
                    table.ForeignKey(
                        name: "fk_menu_pos_mapping_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pms_demand_snapshot",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    property_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    business_date = table.Column<DateTime>(type: "datetime2", nullable: false),
                    source = table.Column<string>(type: "nvarchar(40)", nullable: false),
                    provider = table.Column<string>(type: "nvarchar(40)", nullable: false),
                    occupancy_percent = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    rooms_available = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    rooms_occupied = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    expected_guests = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    adults = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    children = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    arrivals = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    departures = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    stayovers = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    reservations = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    forecast_reservations = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    group_bookings = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    meal_plans = table.Column<string>(type: "nvarchar(400)", nullable: true),
                    events = table.Column<string>(type: "nvarchar(400)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(40)", nullable: false),
                    source_timestamp = table.Column<DateTime>(type: "datetime2", nullable: true),
                    last_successful_sync = table.Column<DateTime>(type: "datetime2", nullable: true),
                    freshness = table.Column<string>(type: "nvarchar(40)", nullable: true),
                    message = table.Column<string>(type: "nvarchar(1000)", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pms_demand_snapshot", x => x.id);
                    table.ForeignKey(
                        name: "fk_pms_demand_snapshot_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "menu_engineering_settings",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    default_meal_participation = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    default_item_participation = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    default_buffer_percentage = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    default_adult_factor = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    default_child_factor = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    popularity_threshold = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    high_food_cost_percent = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    stale_hours = table.Column<int>(type: "int", nullable: false),
                    meal_periods_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    categories_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    pms_provider = table.Column<string>(type: "nvarchar(40)", nullable: true),
                    pms_connection_name = table.Column<string>(type: "nvarchar(120)", nullable: true),
                    pos_connection_name = table.Column<string>(type: "nvarchar(120)", nullable: true),
                    ai_notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_menu_engineering_settings", x => x.id);
                    table.ForeignKey(
                        name: "fk_menu_engineering_settings_buyer_business_profile_buyer_id",
                        column: x => x.buyer_id,
                        principalSchema: "buyersystem",
                        principalTable: "buyer_business_profile",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(name: "ix_menu_item_buyer_id", schema: "buyersystem", table: "menu_item", column: "buyer_id");
            migrationBuilder.CreateIndex(name: "ix_menu_plan_buyer_id", schema: "buyersystem", table: "menu_plan", column: "buyer_id");
            migrationBuilder.CreateIndex(name: "ix_menu_plan_line_menu_plan_id", schema: "buyersystem", table: "menu_plan_line", column: "menu_plan_id");
            migrationBuilder.CreateIndex(name: "ix_menu_pos_mapping_buyer_id", schema: "buyersystem", table: "menu_pos_mapping", column: "buyer_id");
            migrationBuilder.CreateIndex(name: "ix_pms_demand_snapshot_buyer_id", schema: "buyersystem", table: "pms_demand_snapshot", column: "buyer_id");
            migrationBuilder.CreateIndex(name: "ix_menu_engineering_settings_buyer_id", schema: "buyersystem", table: "menu_engineering_settings", column: "buyer_id");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "menu_plan_line", schema: "buyersystem");
            migrationBuilder.DropTable(name: "menu_pos_mapping", schema: "buyersystem");
            migrationBuilder.DropTable(name: "pms_demand_snapshot", schema: "buyersystem");
            migrationBuilder.DropTable(name: "menu_engineering_settings", schema: "buyersystem");
            migrationBuilder.DropTable(name: "menu_plan", schema: "buyersystem");
            migrationBuilder.DropTable(name: "menu_item", schema: "buyersystem");
        }
    }
}
