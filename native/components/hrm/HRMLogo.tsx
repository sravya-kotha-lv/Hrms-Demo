import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export default function HRMHomePage() {
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <View style={styles.container}>
      
      {/* 🔵 Header */}
      <View style={styles.header}>
      
        {/* Left Logo */}
        <View style={styles.logoContainer}>
          <MaterialIcons name="groups" size={26} color="#fff" />
          <Text style={styles.logoText}>HRM</Text>
        </View>

        {/* Right User Icon */}
        <TouchableOpacity onPress={() => setMenuVisible(true)}>
          <MaterialIcons name="account-circle" size={32} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Page Content */}
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to HRM Dashboard</Text>
      </View>

      {/* Dropdown Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.dropdown}>
            <TouchableOpacity style={styles.menuItem}>
              <MaterialIcons name="person" size={20} color="#333" />
              <Text style={styles.menuText}>Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <MaterialIcons name="logout" size={20} color="#333" />
              <Text style={styles.menuText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },

  header: {
    height: 80,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 6,
  },

  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  logoText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  title: {
    fontSize: 20,
    fontWeight: '600',
  },

  overlay: {
    flex: 1,
    alignItems: 'flex-end',
    paddingTop: 85,
    paddingRight: 15,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },

  dropdown: {
    width: 150,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 10,
    elevation: 8,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    gap: 10,
  },

  menuText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
