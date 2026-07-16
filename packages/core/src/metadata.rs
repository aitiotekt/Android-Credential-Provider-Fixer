use serde::{Deserialize, Serialize};

pub const PRODUCT_NAME: &str = "Android Credential Provider Fixer";
pub const DEVELOPMENT_PHASE: &str = "engineering-baseline";

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub product_name: String,
    pub version: String,
    pub development_phase: String,
    pub adb_operations_enabled: bool,
}

#[must_use]
pub fn app_info() -> AppInfo {
    AppInfo {
        product_name: PRODUCT_NAME.to_owned(),
        version: env!("CARGO_PKG_VERSION").to_owned(),
        development_phase: DEVELOPMENT_PHASE.to_owned(),
        adb_operations_enabled: false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn baseline_metadata_never_claims_adb_support() {
        let info = app_info();

        assert_eq!(info.product_name, PRODUCT_NAME);
        assert_eq!(info.version, "0.1.0-alpha.1");
        assert_eq!(info.development_phase, DEVELOPMENT_PHASE);
        assert!(!info.adb_operations_enabled);
    }
}
