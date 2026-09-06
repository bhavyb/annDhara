"""
Nexus Forecaster Module
Module 1: Fair Price Predictor
Builds time-series price forecasts using Facebook Prophet (with scikit-learn trend fallback)
Forecasts the next 7 days of commodity prices for any (crop, mandi) pair.
Derives a fair price band (forecast ± confidence interval) in both ₹/quintal and ₹/kg.
Caches trained models as pickle files in backend/data/models/ for sub-second responses.
"""

import logging
import os
import pickle
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
try:
    from prophet import Prophet
except ImportError:
    Prophet = None
from sklearn.linear_model import Ridge

from data_cleaner import clean_text
from data_fetcher import get_historical_series, resolve_mandi, get_commodity_real_records

logger = logging.getLogger("NexusForecaster")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "data", "models")
os.makedirs(MODELS_DIR, exist_ok=True)


def sanitize_filename(name: str) -> str:
    """Sanitizes crop and mandi names for pickle file storage."""
    return re.sub(r'[^a-zA-Z0-9_-]', '_', name.lower())


def get_model_path(crop: str, mandi: str) -> str:
    return os.path.join(MODELS_DIR, f"{sanitize_filename(crop)}__{sanitize_filename(mandi)}.pkl")


def train_prophet_model(df: pd.DataFrame) -> Tuple[Any, pd.DataFrame]:
    """
    Fits a Facebook Prophet model on historical arrival data.
    df must contain columns 'ds' and 'y'.
    """
    if Prophet is None:
        raise ImportError("Facebook Prophet is not installed. Using Ridge regression fallback.")

    # Daily seasonality False, weekly seasonality True for mandi trading cycles
    model = Prophet(
        daily_seasonality=False,
        weekly_seasonality=True,
        yearly_seasonality=False,
        interval_width=0.85, # 85% confidence interval for fair price band
        changepoint_prior_scale=0.05
    )
    model.fit(df)
    
    # Create 7-day future dataframe
    future = model.make_future_dataframe(periods=7, freq='D')
    forecast = model.predict(future)
    return model, forecast


def fallback_linear_forecast(df: pd.DataFrame, days: int = 7) -> pd.DataFrame:
    """
    Fallback using Ridge regression + rolling standard deviation
    when historical records are sparse or during prototype fallback mode.
    """
    df = df.sort_values('ds').reset_index(drop=True)
    df['day_idx'] = (df['ds'] - df['ds'].min()).dt.days
    
    X = df[['day_idx']].values
    y = df['y'].values

    reg = Ridge(alpha=1.0)
    reg.fit(X, y)

    last_date = df['ds'].max()
    std_err = float(np.std(y - reg.predict(X))) if len(y) > 2 else float(np.mean(y) * 0.05)
    std_err = max(std_err, float(np.mean(y) * 0.03))

    future_dates = [last_date + timedelta(days=i) for i in range(1, days + 1)]
    future_day_indices = [[(d - df['ds'].min()).days] for d in future_dates]

    predictions = reg.predict(future_day_indices)

    future_df = pd.DataFrame({
        'ds': future_dates,
        'yhat': predictions,
        'yhat_lower': predictions - 1.44 * std_err,
        'yhat_upper': predictions + 1.44 * std_err
    })
    return future_df


def predict_fair_price(crop: str, mandi: str, force_retrain: bool = False) -> Dict[str, Any]:
    """
    Main prediction entrypoint for Module 1.
    Returns:
    - today_modal_price (₹/quintal & ₹/kg)
    - fair_price_band_kg: { min: ..., fair: ..., max: ... }
    - fair_price_band_quintal: { min: ..., fair: ..., max: ... }
    - forecast_7_days: list of daily predictions
    - historical_points: past 14 days of actual mandi arrivals
    - confidence_pct: confidence score
    - model_engine: 'Facebook Prophet' or 'Prototype/Fallback Data'
    """
    crop_clean = clean_text(crop)
    canonical = resolve_mandi(mandi, commodity=crop_clean)
    mandi_clean = canonical.get("market") if canonical else clean_text(mandi)
    mandi_display = canonical.get("market") if canonical else mandi

    model_file = get_model_path(crop_clean, mandi_clean)

    # 1. Fetch historical series from cached/live Agmarknet dataset
    history = get_historical_series(crop_clean, mandi_clean)
    is_fallback = False
    fallback_notice = ""
    model_type = "Facebook Prophet"

    if not history:
        # No historical arrival records reported for this specific crop at this mandi.
        # Provide Prototype/Fallback baseline clearly tagged as fallback data.
        is_fallback = True
        model_type = "Prototype/Fallback Data"
        fallback_notice = f"Historical arrival data is unavailable for {crop_clean} at {mandi_display}. Showing regional prototype baseline estimate."

        crop_records = get_commodity_real_records(crop_clean)
        if crop_records:
            prices = [float(r.get("modal_price", 0)) for r in crop_records if r.get("modal_price")]
            base_modal = round(sum(prices) / len(prices), 2) if prices else 2200.0
            min_p = round(base_modal * 0.90, 2)
            max_p = round(base_modal * 1.10, 2)
        else:
            base_modal = 2500.0
            min_p = 2200.0
            max_p = 2800.0

        today = datetime.now().date()
        history = []
        for i in range(13, -1, -1):
            d = today - timedelta(days=i)
            offset = np.sin(i * 0.5) * 0.015
            p = round(base_modal * (1.0 + offset), 2)
            history.append({
                "arrival_date": d.strftime("%Y-%m-%d"),
                "modal_price": p,
                "modal_price_kg": round(p / 100.0, 2),
                "min_price": min_p,
                "max_price": max_p
            })

    # Build DataFrame for training
    data_rows = []
    for r in history:
        date_str = r.get("arrival_date")
        price = r.get("modal_price")
        if date_str and price and float(price) > 0:
            data_rows.append({"ds": pd.to_datetime(date_str), "y": float(price)})

    df = pd.DataFrame(data_rows).drop_duplicates(subset=['ds']).sort_values('ds')

    model = None
    forecast = None

    if not is_fallback:
        # Check if cached trained Prophet model exists and not forced retrain
        if os.path.exists(model_file) and not force_retrain:
            try:
                with open(model_file, "rb") as f:
                    saved_obj = pickle.load(f)
                    model = saved_obj.get("model")
                    if model:
                        future = model.make_future_dataframe(periods=7, freq='D')
                        forecast = model.predict(future)
                        model_type = "Facebook Prophet"
                        logger.info(f"Loaded cached Prophet model for {crop_clean} - {mandi_clean}")
            except Exception as e:
                logger.warning(f"Failed to load cached model: {e}. Will retrain.")
                model = None

        # Train Facebook Prophet model if not loaded from cache
        if model is None or forecast is None:
            try:
                if len(df) >= 3 and Prophet is not None:
                    model, forecast = train_prophet_model(df)
                    model_type = "Facebook Prophet"
                    # Cache model to pickle file
                    with open(model_file, "wb") as f:
                        pickle.dump({"model": model, "crop": crop_clean, "mandi": mandi_clean, "trained_at": datetime.now().isoformat()}, f)
                    logger.info(f"Trained & cached new Facebook Prophet model for {crop_clean} - {mandi_clean}")
                else:
                    forecast = fallback_linear_forecast(df, days=7)
                    model_type = "Linear Trend Model"
            except Exception as e:
                logger.warning(f"Prophet fitting error: {e}. Falling back to linear trend.")
                forecast = fallback_linear_forecast(df, days=7)
                model_type = "Linear Trend Model"
    else:
        forecast = fallback_linear_forecast(df, days=7)
        model_type = "Prototype/Fallback Data"

    # Filter forecast to only future 7 days
    last_hist_date = df['ds'].max()
    future_forecast = forecast[forecast['ds'] > last_hist_date].head(7).copy()
    if future_forecast.empty:
        future_forecast = forecast.tail(7).copy()

    # Format 7-day forecast series
    trend_series = []
    for _, row in future_forecast.iterrows():
        yhat = max(10.0, float(row['yhat']))
        yhat_lower = max(5.0, float(row.get('yhat_lower', yhat * 0.94)))
        yhat_upper = max(yhat, float(row.get('yhat_upper', yhat * 1.06)))

        trend_series.append({
            "date": row['ds'].strftime("%Y-%m-%d"),
            "display_date": row['ds'].strftime("%d %b"),
            "predicted_price_quintal": round(yhat, 2),
            "lower_band_quintal": round(yhat_lower, 2),
            "upper_band_quintal": round(yhat_upper, 2),
            "predicted_price_kg": round(yhat / 100.0, 2),
            "lower_band_kg": round(yhat_lower / 100.0, 2),
            "upper_band_kg": round(yhat_upper / 100.0, 2)
        })

    # Latest actual modal price reported
    latest_hist = df.iloc[-1]
    current_modal_quintal = float(latest_hist['y'])
    current_modal_kg = round(current_modal_quintal / 100.0, 2)

    # Next 7-day average fair price band
    avg_fair_quintal = float(future_forecast['yhat'].mean())
    avg_lower_quintal = float(future_forecast['yhat_lower'].mean()) if 'yhat_lower' in future_forecast else avg_fair_quintal * 0.94
    avg_upper_quintal = float(future_forecast['yhat_upper'].mean()) if 'yhat_upper' in future_forecast else avg_fair_quintal * 1.06

    # Format past 14 days historical actual points for the chart
    hist_tail = df.tail(14)
    historical_points = []
    for _, row in hist_tail.iterrows():
        val = float(row['y'])
        historical_points.append({
            "date": row['ds'].strftime("%Y-%m-%d"),
            "display_date": row['ds'].strftime("%d %b"),
            "actual_price_quintal": round(val, 2),
            "actual_price_kg": round(val / 100.0, 2)
        })

    # Calculate expected 7-day price trajectory percentage
    price_change_pct = round(((avg_fair_quintal - current_modal_quintal) / current_modal_quintal) * 100, 1)
    
    if price_change_pct > 2.0:
        trend_direction = "Bullish (Rising)"
        trend_recommendation = "Hold produce for 3–5 days if storage allows, as prices are trending upward."
    elif price_change_pct < -2.0:
        trend_direction = "Bearish (Softening)"
        trend_recommendation = "Sell early to lock in current market rates before arrivals surge."
    else:
        trend_direction = "Stable"
        trend_recommendation = "Prices are stable. Sell according to your logistical convenience."

    return {
        "crop": crop_clean,
        "mandi": mandi_display,
        "current_modal_price_quintal": round(current_modal_quintal, 2),
        "current_modal_price_kg": current_modal_kg,
        "fair_price_band_kg": {
            "min": round(avg_lower_quintal / 100.0, 2),
            "fair": round(avg_fair_quintal / 100.0, 2),
            "max": round(avg_upper_quintal / 100.0, 2)
        },
        "fair_price_band_quintal": {
            "min": round(avg_lower_quintal, 2),
            "fair": round(avg_fair_quintal, 2),
            "max": round(avg_upper_quintal, 2)
        },
        "forecast_7_days": trend_series,
        "historical_points": historical_points,
        "trend_summary": {
            "change_pct": price_change_pct,
            "direction": trend_direction,
            "recommendation": trend_recommendation
        },
        "model_engine": model_type,
        "is_fallback": is_fallback,
        "fallback_notice": fallback_notice,
        "forecast_generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
