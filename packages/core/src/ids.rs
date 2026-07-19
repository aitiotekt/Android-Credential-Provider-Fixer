use std::fmt;

use serde::{Deserialize, Serialize};

macro_rules! entity_id {
    ($name:ident) => {
        #[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize, Deserialize)]
        #[serde(transparent)]
        pub struct $name(String);

        impl $name {
            #[must_use]
            pub fn new(value: impl Into<String>) -> Self {
                Self(value.into())
            }

            #[must_use]
            pub fn as_str(&self) -> &str {
                &self.0
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str(&self.0)
            }
        }

        impl From<String> for $name {
            fn from(value: String) -> Self {
                Self(value)
            }
        }

        impl From<&str> for $name {
            fn from(value: &str) -> Self {
                Self(value.to_owned())
            }
        }
    };
}

entity_id!(DiscoveryId);
entity_id!(AdbSelectionId);
entity_id!(DeviceEnumerationId);
entity_id!(DeviceId);
entity_id!(DiagnosisId);
entity_id!(ProviderId);
entity_id!(PreviewId);
entity_id!(PlanId);
entity_id!(ExecutionId);
entity_id!(SnapshotId);
