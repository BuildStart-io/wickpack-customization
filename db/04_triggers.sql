-- Create triggers for the new schema
DROP TRIGGER IF EXISTS on_auth_user_created_wickpack ON auth.users;
CREATE TRIGGER on_auth_user_created_wickpack
  AFTER INSERT ON auth.users 
  FOR EACH ROW 
  EXECUTE FUNCTION wickpack_customization.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_role_wickpack ON auth.users;
CREATE TRIGGER on_auth_user_role_wickpack
  AFTER INSERT ON auth.users 
  FOR EACH ROW 
  EXECUTE FUNCTION wickpack_customization.handle_new_user_role();

DROP TRIGGER IF EXISTS on_auth_user_settings_wickpack ON auth.users;
CREATE TRIGGER on_auth_user_settings_wickpack
  AFTER INSERT ON auth.users 
  FOR EACH ROW 
  EXECUTE FUNCTION wickpack_customization.handle_new_user_settings();
