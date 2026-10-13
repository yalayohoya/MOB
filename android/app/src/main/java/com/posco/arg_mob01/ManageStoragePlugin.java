package com.posco.arg_mob01;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ManageStorage")
public class ManageStoragePlugin extends Plugin {

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject ret = new JSObject();
        boolean isApi30OrAbove = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R;
        ret.put("isAndroid11OrAbove", isApi30OrAbove);
        if (isApi30OrAbove) {
            ret.put("granted", Environment.isExternalStorageManager());
        } else {
            ret.put("granted", false);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (Environment.isExternalStorageManager()) {
                ret.put("granted", true);
                call.resolve(ret);
            } else {
                try {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                    Uri uri = Uri.fromParts("package", getContext().getPackageName(), null);
                    intent.setData(uri);
                    getActivity().startActivity(intent);
                    ret.put("requested", true);
                    call.resolve(ret);
                } catch (Exception e) {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                    getActivity().startActivity(intent);
                    ret.put("requested", true);
                    call.resolve(ret);
                }
            }
        } else {
            ret.put("granted", false);
            call.resolve(ret);
        }
    }
}
