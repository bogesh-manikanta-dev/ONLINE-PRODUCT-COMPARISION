CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_user_id" integer,
	"actor_email" text DEFAULT 'system' NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text DEFAULT '' NOT NULL,
	"details_json" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"country" text DEFAULT 'Global' NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"accent_color" text DEFAULT '#D4AF37' NOT NULL,
	"hero_description" text DEFAULT '' NOT NULL,
	"sound_profile" text DEFAULT 'chime_gold' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "brands_name_unique" UNIQUE("name"),
	CONSTRAINT "brands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"cart_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"guest_token" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "carts_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "carts_guest_token_unique" UNIQUE("guest_token")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"domain_group" text NOT NULL,
	"description" text NOT NULL,
	"icon_name" text DEFAULT 'Layers' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "comparison_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"comparison_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comparisons" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"title" text NOT NULL,
	"category_id" integer NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"change_amount" integer NOT NULL,
	"previous_stock" integer NOT NULL,
	"new_stock" integer NOT NULL,
	"reason" text NOT NULL,
	"actor_email" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer,
	"product_name_snapshot" text NOT NULL,
	"brand_name_snapshot" text NOT NULL,
	"model_snapshot" text NOT NULL,
	"variant_snapshot" text DEFAULT '' NOT NULL,
	"image_snapshot" text DEFAULT '' NOT NULL,
	"unit_price_snapshot" double precision NOT NULL,
	"tax_rate_snapshot" double precision DEFAULT 18 NOT NULL,
	"quantity" integer NOT NULL,
	"line_total" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"status" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"actor_email" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"user_id" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'Order Placed' NOT NULL,
	"payment_mode" text NOT NULL,
	"payment_status" text DEFAULT 'DEMO_VERIFIED' NOT NULL,
	"shipping_address_json" text NOT NULL,
	"delivery_method" text DEFAULT 'STANDARD' NOT NULL,
	"subtotal" double precision NOT NULL,
	"delivery_charge" double precision NOT NULL,
	"tax_amount" double precision NOT NULL,
	"total_amount" double precision NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"cancellation_reason" text,
	"cancelled_at" timestamp,
	"estimated_delivery_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "orders_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "price_observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"seller_id" integer NOT NULL,
	"price" double precision NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"source_label" text DEFAULT 'Seeded Historical Snapshot (Demo)' NOT NULL,
	"is_demo_data" boolean DEFAULT true NOT NULL,
	"observed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"url" text NOT NULL,
	"alt_text" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"seller_id" integer NOT NULL,
	"price" double precision NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"delivery_charge" double precision,
	"installation_charge" double precision,
	"warranty_cost" double precision,
	"required_accessories_cost" double precision,
	"additional_fees" double precision,
	"additional_fees_note" text DEFAULT '' NOT NULL,
	"availability_status" text DEFAULT 'IN_STOCK' NOT NULL,
	"offer_url" text DEFAULT '' NOT NULL,
	"data_source" text DEFAULT 'Admin-Entered Demo Observation' NOT NULL,
	"last_verified_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_specifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"spec_definition_id" integer NOT NULL,
	"raw_value" text NOT NULL,
	"numeric_value" double precision,
	"unit" text DEFAULT '' NOT NULL,
	"normalized_value" double precision,
	"is_conflicting" boolean DEFAULT false NOT NULL,
	"source_note" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"brand_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"subcategory_id" integer,
	"description" text NOT NULL,
	"model_number" text NOT NULL,
	"variant_label" text DEFAULT 'Standard Edition' NOT NULL,
	"base_price" double precision NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"stock_quantity" integer DEFAULT 25 NOT NULL,
	"tax_rate_percent" double precision DEFAULT 18 NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"availability_status" text DEFAULT 'IN_STOCK' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"rating" double precision,
	"review_count" integer DEFAULT 0 NOT NULL,
	"popularity_score" integer DEFAULT 50 NOT NULL,
	"model_3d_preset" text DEFAULT 'auto' NOT NULL,
	"model_3d_url" text DEFAULT '' NOT NULL,
	"finish_hex" text DEFAULT '#D4AF37' NOT NULL,
	"is_demo_data" boolean DEFAULT true NOT NULL,
	"data_source_label" text DEFAULT 'CompareX Seeded Demonstration Catalog' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "recently_viewed" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"category_id" integer NOT NULL,
	"budget_min" double precision,
	"budget_max" double precision NOT NULL,
	"intended_usage" text NOT NULL,
	"preferred_brand_id" integer,
	"criteria_json" text NOT NULL,
	"results_summary_json" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"order_item_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'Requested' NOT NULL,
	"admin_note" text DEFAULT '' NOT NULL,
	"demo_refund_amount" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sellers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"reliability_note" text DEFAULT 'Demo Merchant Record' NOT NULL,
	"is_authorized_api" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sellers_name_unique" UNIQUE("name"),
	CONSTRAINT "sellers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "specification_definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"data_type" text DEFAULT 'text' NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"higher_is_better" boolean,
	"is_mandatory" boolean DEFAULT false NOT NULL,
	"is_comparable" boolean DEFAULT true NOT NULL,
	"enum_values_json" text DEFAULT '[]' NOT NULL,
	"weight" double precision DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subcategories" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"label" text DEFAULT 'Home' NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"house_building" text NOT NULL,
	"street" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"postal_code" text NOT NULL,
	"country" text DEFAULT 'India' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"preferred_currency" text DEFAULT 'INR' NOT NULL,
	"default_budget_max" double precision,
	"preferred_categories_json" text DEFAULT '[]' NOT NULL,
	"priority_weights_json" text DEFAULT '{"performance":0.35,"value":0.35,"efficiency":0.15,"reliability":0.15}' NOT NULL,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text,
	"role_id" integer,
	"role" text DEFAULT 'CONSUMER' NOT NULL,
	"avatar_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_uid_unique" UNIQUE("uid"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"wishlist_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"target_price" double precision,
	"notes" text DEFAULT '' NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishlists" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text DEFAULT 'My Wishlist' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wishlists_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparison_items" ADD CONSTRAINT "comparison_items_comparison_id_comparisons_id_fk" FOREIGN KEY ("comparison_id") REFERENCES "public"."comparisons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparison_items" ADD CONSTRAINT "comparison_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_offers" ADD CONSTRAINT "product_offers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_offers" ADD CONSTRAINT "product_offers_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_specifications" ADD CONSTRAINT "product_specifications_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_specifications" ADD CONSTRAINT "product_specifications_spec_definition_id_specification_definitions_id_fk" FOREIGN KEY ("spec_definition_id") REFERENCES "public"."specification_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_requests" ADD CONSTRAINT "recommendation_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_requests" ADD CONSTRAINT "recommendation_requests_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specification_definitions" ADD CONSTRAINT "specification_definitions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wishlist_id_wishlists_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_created" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cart_item" ON "cart_items" USING btree ("cart_id","product_id");--> statement-breakpoint
CREATE INDEX "idx_cart_items_cart" ON "cart_items" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "idx_carts_guest" ON "carts" USING btree ("guest_token");--> statement-breakpoint
CREATE INDEX "idx_categories_domain" ON "categories" USING btree ("domain_group");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_comp_item" ON "comparison_items" USING btree ("comparison_id","product_id");--> statement-breakpoint
CREATE INDEX "idx_comp_items_comp" ON "comparison_items" USING btree ("comparison_id");--> statement-breakpoint
CREATE INDEX "idx_comparisons_user" ON "comparisons" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_logs_prod" ON "inventory_logs" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_order_items_order" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_order_history_order" ON "order_status_history" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_orders_user" ON "orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_orders_status" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_price_obs_prod_date" ON "price_observations" USING btree ("product_id","observed_at");--> statement-breakpoint
CREATE INDEX "idx_price_obs_seller" ON "price_observations" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_product_images_prod" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_offer_prod_seller" ON "product_offers" USING btree ("product_id","seller_id");--> statement-breakpoint
CREATE INDEX "idx_offer_prod" ON "product_offers" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_prod_spec" ON "product_specifications" USING btree ("product_id","spec_definition_id");--> statement-breakpoint
CREATE INDEX "idx_prod_spec_prod" ON "product_specifications" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_products_cat" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_products_brand" ON "products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "idx_products_price" ON "products" USING btree ("base_price");--> statement-breakpoint
CREATE INDEX "idx_products_status" ON "products" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_recently_viewed" ON "recently_viewed" USING btree ("user_id","product_id");--> statement-breakpoint
CREATE INDEX "idx_recently_viewed_user" ON "recently_viewed" USING btree ("user_id","viewed_at");--> statement-breakpoint
CREATE INDEX "idx_rec_req_user" ON "recommendation_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_return_requests_order" ON "return_requests" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_return_requests_user" ON "return_requests" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_spec_def_cat_key" ON "specification_definitions" USING btree ("category_id","key");--> statement-breakpoint
CREATE INDEX "idx_spec_def_cat" ON "specification_definitions" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_subcategories_cat_slug" ON "subcategories" USING btree ("category_id","slug");--> statement-breakpoint
CREATE INDEX "idx_subcategories_cat" ON "subcategories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_user_addresses_user" ON "user_addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_wishlist_item" ON "wishlist_items" USING btree ("wishlist_id","product_id");--> statement-breakpoint
CREATE INDEX "idx_wishlist_items_wl" ON "wishlist_items" USING btree ("wishlist_id");