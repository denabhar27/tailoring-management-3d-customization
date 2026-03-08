import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface InlineHelpProps {
  text: string;
  type?: "info" | "warning" | "error" | "success";
  dismissible?: boolean;
  onDismiss?: () => void;
}

export const InlineHelp: React.FC<InlineHelpProps> = ({
  text,
  type = "info",
  dismissible = true,
  onDismiss,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  const getStylesForType = () => {
    switch (type) {
      case "error":
        return {
          icon: "alert-circle" as const,
          iconColor: "#D32F2F",
          borderColor: "#D32F2F",
          backgroundColor: "#FFEBEE",
          textColor: "#C62828",
        };
      case "warning":
        return {
          icon: "warning" as const,
          iconColor: "#F57C00",
          borderColor: "#FF9800",
          backgroundColor: "#FFF3E0",
          textColor: "#E65100",
        };
      case "success":
        return {
          icon: "checkmark-circle" as const,
          iconColor: "#388E3C",
          borderColor: "#4CAF50",
          backgroundColor: "#E8F5E9",
          textColor: "#2E7D32",
        };
      default:
        return {
          icon: "information-circle" as const,
          iconColor: "#1976D2",
          borderColor: "#2196F3",
          backgroundColor: "#E3F2FD",
          textColor: "#1565C0",
        };
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) return null;

  const { icon, iconColor, borderColor, backgroundColor, textColor } = getStylesForType();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          borderLeftColor: borderColor,
        },
      ]}
    >
      <Ionicons name={icon} size={18} color={iconColor} style={styles.icon} />
      <Text style={[styles.text, { color: textColor }]}>{text}</Text>
      {dismissible && (
        <TouchableOpacity onPress={handleDismiss} style={styles.closeButton}>
          <Ionicons name="close" size={18} color="#999" />
        </TouchableOpacity>
      )}
    </View>
  );
};

interface FormFieldHelpProps {
  text: string;
  alwaysVisible?: boolean;
}

export const FormFieldHelp: React.FC<FormFieldHelpProps> = ({
  text,
  alwaysVisible = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(alwaysVisible);

  if (alwaysVisible) {
    return (
      <View style={styles.formFieldContainer}>
        <Ionicons name="information-circle-outline" size={14} color="#666" />
        <Text style={styles.formFieldText}>{text}</Text>
      </View>
    );
  }

  return (
    <View>
      <TouchableOpacity
        style={styles.helpTrigger}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <Ionicons
          name={isExpanded ? "information-circle" : "information-circle-outline"}
          size={16}
          color="#666"
        />
        <Text style={styles.helpTriggerText}>
          {isExpanded ? "Hide help" : "Show help"}
        </Text>
      </TouchableOpacity>
      {isExpanded && (
        <View style={styles.expandedHelp}>
          <Text style={styles.expandedHelpText}>{text}</Text>
        </View>
      )}
    </View>
  );
};

interface TooltipHelpProps {
  label: string;
  helpText: string;
}

export const TooltipHelp: React.FC<TooltipHelpProps> = ({ label, helpText }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <View style={styles.tooltipContainer}>
      <Text style={styles.tooltipLabel}>{label}</Text>
      <TouchableOpacity
        onPress={() => setShowTooltip(!showTooltip)}
        style={styles.tooltipButton}
      >
        <Ionicons
          name="help-circle-outline"
          size={18}
          color="#666"
        />
      </TouchableOpacity>
      {showTooltip && (
        <View style={styles.tooltipBubble}>
          <Text style={styles.tooltipText}>{helpText}</Text>
          <View style={styles.tooltipArrow} />
        </View>
      )}
    </View>
  );
};

interface ValidationHelpProps {
  requirements: {
    label: string;
    isMet: boolean;
  }[];
}

export const ValidationHelp: React.FC<ValidationHelpProps> = ({ requirements }) => {
  return (
    <View style={styles.validationContainer}>
      {requirements.map((req, index) => (
        <View key={index} style={styles.validationRow}>
          <Ionicons
            name={req.isMet ? "checkmark-circle" : "ellipse-outline"}
            size={16}
            color={req.isMet ? "#4CAF50" : "#999"}
          />
          <Text
            style={[
              styles.validationText,
              req.isMet && styles.validationTextMet,
            ]}
          >
            {req.label}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({

  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    marginVertical: 8,
  },
  icon: {
    marginRight: 10,
    marginTop: 1,
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },

  formFieldContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
  },
  formFieldText: {
    fontSize: 12,
    color: "#666",
    flex: 1,
  },
  helpTrigger: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 4,
  },
  helpTriggerText: {
    fontSize: 12,
    color: "#666",
  },
  expandedHelp: {
    backgroundColor: "#f5f5f5",
    padding: 10,
    borderRadius: 6,
    marginTop: 6,
  },
  expandedHelpText: {
    fontSize: 12,
    color: "#555",
    lineHeight: 18,
  },

  tooltipContainer: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  tooltipLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  tooltipButton: {
    padding: 4,
    marginLeft: 4,
  },
  tooltipBubble: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "#333",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    zIndex: 1000,
  },
  tooltipText: {
    fontSize: 12,
    color: "#fff",
    lineHeight: 18,
  },
  tooltipArrow: {
    position: "absolute",
    top: -6,
    left: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#333",
  },

  validationContainer: {
    marginTop: 8,
    gap: 6,
  },
  validationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  validationText: {
    fontSize: 12,
    color: "#666",
  },
  validationTextMet: {
    color: "#4CAF50",
  },
});

export default InlineHelp;
